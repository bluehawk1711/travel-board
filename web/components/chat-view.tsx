"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Socket } from "socket.io-client";
import {
  MessagesSquare,
  Pencil,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  createDirectConversation,
  createGroupConversation,
  sendChatMessage,
} from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  conversationListQueryOptions,
  conversationQueryOptions,
  meQueryOptions,
  messagesQueryOptions,
  presenceQueryOptions,
  useUserSearch,
} from "@/lib/queries";
import {
  conversationTitle,
  type ChatMessage,
  type ConversationDetail,
  type ConversationMember,
  type ConversationSummary,
} from "@/lib/chat-types";
import type { AuthUser, SearchUser } from "@/lib/types";
import { getBoardSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import ChatContent from "@/components/shadcn-space/radix/blocks/chat-application-01/chat-content";
import ChatMsgSent from "@/components/shadcn-space/radix/blocks/chat-application-01/chat-msgsent";
import type { Chat } from "@/components/shadcn-space/radix/blocks/chat-application-01/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

/** A conversation row in the sidebar (extends the API summary with a label). */
interface ListRow extends ConversationSummary {
  label: string;
}

function AvatarStack({ members, size = 36 }: { members: ConversationSummary["members"]; size?: number }) {
  const shown = members.slice(0, 3);
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((m, i) => (
        <span
          key={m.userId}
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-200",
          )}
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -size / 3,
          }}
        >
          {m.avatarUrl ? (
            <Image
              src={m.avatarUrl}
              alt=""
              width={size}
              height={size}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            m.name.slice(0, 2).toUpperCase()
          )}
        </span>
      ))}
    </span>
  );
}

function toChatView(
  conversation: ConversationDetail,
  messages: ChatMessage[],
  excerpt: string,
  status: "online" | "offline",
): Chat {
  return {
    id: conversation.id,
    name: conversation.name ?? "Conversation",
    thumb: "",
    status,
    excerpt,
    messages,
    members: conversation.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
    })),
  };
}

export function ChatView({
  initialTargetUserId,
}: {
  initialTargetUserId?: string;
}) {
  const queryClient = useQueryClient();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadedOlder, setLoadedOlder] = useState(false);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // New-chat modal state
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [picked, setPicked] = useState<SearchUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  // User search goes through React Query (debounced below).
  const { data: userSearchData } = useUserSearch(debouncedUserQuery);
  const userResults = userSearchData?.users ?? [];

  // Writes also run through React Query mutations so every call site shares
  // one cache/invalidation story.
  const sendMutation = useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: string;
    }) => sendChatMessage(conversationId, body),
  });
  const createDirectMutation = useMutation({
    mutationFn: (userId: string) => createDirectConversation(userId),
  });
  const createGroupMutation = useMutation({
    mutationFn: ({
      name,
      memberIds,
    }: {
      name: string | null;
      memberIds: string[];
    }) => createGroupConversation(name, memberIds),
  });

  const liveRef = useRef<{ socket: Socket; remove: () => void } | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const rowsRef = useRef<ListRow[]>([]);
  const meRef = useRef<AuthUser | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ── Boot: identity + conversation list ───────────────────
  // Opening a conversation loads detail + first page of messages through the
  // React Query cache. Declared before the boot effect that calls it.
  const openConversation = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId);
      setMobileListOpen(false);
      setError(null);
      setLoadingConv(true);
      try {
        const [conv, page] = await Promise.all([
          queryClient.fetchQuery(conversationQueryOptions(conversationId)),
          queryClient.fetchQuery({
            ...messagesQueryOptions(conversationId),
            staleTime: 0,
          }),
        ]);
        setActiveConv(conv);
        setMessages(page.items);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open chat");
      } finally {
        setLoadingConv(false);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoadingList(true);
      setError(null);
      try {
        const user = await queryClient.fetchQuery(meQueryOptions);
        if (cancelled) return;
        setMe(user);
        const summaries = await queryClient.fetchQuery(
          conversationListQueryOptions,
        );
        if (cancelled) return;
        setRows(
          summaries.map((s) => ({
            ...s,
            label: conversationTitle(s, user.id),
          })),
        );
        // Deep link: ?user=<id> opens (or creates) a DM.
        if (initialTargetUserId) {
          const existing = summaries.find(
            (s) =>
              s.type === "DIRECT" &&
              s.members.some((m: ConversationMember) => m.userId === initialTargetUserId),
          );
          if (existing) {
            void openConversation(existing.id);
          } else {
            try {
              const conv = await createDirectMutation.mutateAsync(
                initialTargetUserId,
              );
              if (cancelled) return;
              setRows((prev) => [
                {
                  ...(conv as unknown as ConversationSummary),
                  label: conversationTitle(conv, user.id),
                  lastMessage: null,
                  unreadCount: 0,
                  createdAt: conv.createdAt,
                  updatedAt: conv.updatedAt,
                },
                ...prev,
              ]);
              await openConversation(conv.id);
            } catch {
              // user not found or not signed in — list stays as-is
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't load your chats",
          );
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      liveRef.current?.remove();
      liveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTargetUserId]);

  // ── Live socket wiring for the active conversation ───────
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    async function attach() {
      try {
        const socket = await getBoardSocket();
        if (cancelled) return;
        socket.emit(
          "conversation:join",
          { conversationId: activeId },
          () => undefined,
        );
        // Mark the newly opened conversation read.
        if (messagesRef.current.length > 0) {
          const last = messagesRef.current[messagesRef.current.length - 1];
          socket.emit("message:read", {
            conversationId: activeId,
            lastMessageId: last.id,
          });
        }
        setRows((prev) =>
          prev.map((r) =>
            r.id === activeId ? { ...r, unreadCount: 0 } : r,
          ),
        );

        const onNew = (payload: ChatMessage & { clientId?: string }) => {
          if (payload.conversationId !== activeIdRef.current) {
            // New message in another conversation → bump its unread count.
            setRows((prev) =>
              prev.map((r) =>
                r.id === payload.conversationId
                  ? { ...r, unreadCount: r.unreadCount + 1, lastMessage: payload }
                  : r,
              ),
            );
            return;
          }
          const exists = messagesRef.current.some((m) => m.id === payload.id);
          if (!exists) {
            setMessages((prev) => [...prev, payload]);
          }
          const socketNow = liveRef.current?.socket;
          socketNow?.emit("message:read", {
            conversationId: payload.conversationId,
            lastMessageId: payload.id,
          });
        };
        const onTyping = (payload: { conversationId: string }) => {
          if (payload.conversationId !== activeIdRef.current) return;
          setTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTyping(false), 2500);
        };
        socket.on("message:new", onNew);
        socket.on("user:typing", onTyping);
        liveRef.current = {
          socket,
          remove: () => {
            socket.off("message:new", onNew);
            socket.off("user:typing", onTyping);
          },
        };
      } catch {
        // Anonymous or socket rejected — static REST chat still works.
      }
    }
    void attach();
    return () => {
      cancelled = true;
      liveRef.current?.remove();
      liveRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [activeId]);

  // ── Presence for active conversation members ─────────────
  useEffect(() => {
    if (!activeConv) return;
    let cancelled = false;
    const ids = activeConv.members.map((m) => m.userId).filter((id) => id !== meRef.current?.id);
    if (ids.length === 0) return;
    async function refreshPresence() {
      try {
        const data = await queryClient.fetchQuery(presenceQueryOptions(ids));
        if (!cancelled) setPresence(data);
      } catch {
        // presence is best-effort
      }
    }
    void refreshPresence();
    const timer = setInterval(() => void refreshPresence(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeConv]);

  const loadOlder = useCallback(async () => {
    if (!activeId || !nextCursor || loadedOlder) return;
    setLoadedOlder(true);
    try {
      const page = await queryClient.fetchQuery({
        ...messagesQueryOptions(activeId, nextCursor),
        staleTime: 0,
      });
      setMessages((prev) => [...page.items, ...prev]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadedOlder(false);
    }
  }, [activeId, nextCursor, loadedOlder]);

  const handleSend = useCallback(
    async (conversationId: string, body: string) => {
      setSending(true);
      try {
        const socket = liveRef.current?.socket;
        if (socket?.connected) {
          const ack = await socket
            .timeout(5000)
            .emitWithAck("message:send", { conversationId, body });
          if (ack?.ok && ack.message) {
            setMessages((prev) =>
              prev.some((m) => m.id === ack.message.id)
                ? prev
                : [...prev, ack.message as ChatMessage],
            );
            return;
          }
          if (ack?.error) {
            setError(ack.error);
            return;
          }
        }
        const message = await sendMutation.mutateAsync({ conversationId, body });
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const emitTyping = useCallback(() => {
    const socket = liveRef.current?.socket;
    const convId = activeIdRef.current;
    if (!socket?.connected || !convId) return;
    socket.emit("message:typing", { conversationId: convId });
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const summaries = await queryClient.fetchQuery(
        conversationListQueryOptions,
      );
      setRows(
        summaries.map((s) => ({
          ...s,
          label: conversationTitle(s, meRef.current?.id),
        })),
      );
    } catch {
      // keep current list
    }
  }, [queryClient]);

  // ── New chat modal helpers ───────────────────────────────
  // Debounce keystrokes; the request itself runs through `useUserSearch`.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUserQuery(userQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [userQuery]);

  const runUserSearch = (q: string) => {
    setUserQuery(q);
  };

  const clearUserSearch = () => {
    setUserQuery("");
    setDebouncedUserQuery("");
  };

  const togglePicked = (user: SearchUser) => {
    setPicked((prev) =>
      prev.some((p) => p.id === user.id)
        ? prev.filter((p) => p.id !== user.id)
        : [...prev, user],
    );
  };

  const startDirect = async (user: SearchUser) => {
    setCreating(true);
    try {
      const conv = await createDirectMutation.mutateAsync(user.id);
      await refreshList();
      setNewChatOpen(false);
      setPicked([]);
      clearUserSearch();
      await openConversation(conv.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start chat");
    } finally {
      setCreating(false);
    }
  };

  const startGroup = async () => {
    if (picked.length === 0) return;
    setCreating(true);
    try {
      const conv = await createGroupMutation.mutateAsync({
        name: groupName.trim() || null,
        memberIds: picked.map((p) => p.id),
      });
      await refreshList();
      setNewChatOpen(false);
      setPicked([]);
      setGroupName("");
      clearUserSearch();
      await openConversation(conv.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create group");
    } finally {
      setCreating(false);
    }
  };

  const onlineCount = useMemo(() => {
    if (!activeConv) return 0;
    return activeConv.members.filter(
      (m) => m.userId !== me?.id && presence[m.userId],
    ).length;
  }, [activeConv, presence, me]);

  const excerpt = useMemo(() => {
    if (!activeConv) return "";
    const total = activeConv.members.length;
    if (typing) return "Someone is typing…";
    if (onlineCount > 0) return `${onlineCount} online · ${total} members`;
    return `${total} ${total === 1 ? "member" : "members"}`;
  }, [activeConv, typing, onlineCount]);

  const view = useMemo(
    () =>
      activeConv
        ? toChatView(activeConv, messages, excerpt, onlineCount > 0 ? "online" : "offline")
        : null,
    [activeConv, messages, excerpt, onlineCount],
  );

  if (!me) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <MessagesSquare className="size-10 text-zinc-300 dark:text-zinc-700" />
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Messages
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to chat with travellers, friends and board collaborators.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild size="sm" className="rounded-full">
            <a href="/login">Sign in</a>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <a href="/signup">Create an account</a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex h-[calc(100vh-8.5rem)] w-full max-w-6xl flex-col gap-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-800 lg:h-[calc(100vh-3.5rem)]">
        <div className="flex min-h-0 flex-1">
          {/* Conversation list */}
          <aside
            className={cn(
              "w-full shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:w-80",
              mobileListOpen ? "flex" : "hidden",
            )}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                <MessagesSquare className="size-5 text-emerald-600 dark:text-emerald-400" />
                Messages
              </h1>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer"
                  aria-label="New message"
                  onClick={() => setNewChatOpen(true)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer lg:hidden"
                  aria-label="Close list"
                  onClick={() => setMobileListOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <Separator />
            <ScrollArea className="min-h-0 flex-1">
              {loadingList ? (
                <div className="flex h-full items-center justify-center py-16 text-sm text-zinc-400">
                  Loading conversations…
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No conversations yet.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setNewChatOpen(true)}
                  >
                    Start a chat
                  </Button>
                </div>
              ) : (
                <ul>
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void openConversation(row.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          activeId === row.id
                            ? "bg-zinc-100 dark:bg-zinc-900"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                        )}
                      >
                        <AvatarStack members={row.members} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {row.label}
                            </span>
                            {row.unreadCount > 0 && (
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                                {row.unreadCount > 9 ? "9+" : row.unreadCount}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {row.lastMessage
                              ? `${row.lastMessage.senderName}: ${row.lastMessage.body}`
                              : "Say hello 👋"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </aside>

          {/* Active conversation */}
          <section className="flex min-w-0 flex-1 flex-col">
            {error && !activeConv && !loadingConv ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-zinc-500">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void refreshList()}
                >
                  Reload
                </Button>
              </div>
            ) : loadingConv ? (
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
                Opening conversation…
              </div>
            ) : view ? (
              <>
                <div className="min-h-0 flex-1">
                  <ChatContent
                    selectedChat={view}
                    currentUserId={me.id}
                    onClickMobile={() => setMobileListOpen(true)}
                  />
                </div>
                <div className="shrink-0">
                  {hasMore && (
                    <div className="flex justify-center py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 cursor-pointer text-xs"
                        disabled={loadedOlder}
                        onClick={() => void loadOlder()}
                      >
                        Load earlier messages
                      </Button>
                    </div>
                  )}
                  {error && activeConv ? (
                    <p className="px-5 pb-1 text-xs text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  ) : null}
                  <Separator />
                  <ChatMsgSent
                    selectedChat={view}
                    sending={sending}
                    onSendMessage={(conversationId, body) =>
                      void handleSend(conversationId, body)
                    }
                    onTyping={() => emitTyping()}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-zinc-400">
                <Users className="size-10 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm">
                  Pick a conversation, or start a new one.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* New message sheet */}
      <Sheet open={newChatOpen} onOpenChange={setNewChatOpen}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col p-0">
          <SheetTitle className="sr-only">New message</SheetTitle>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              New message
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer"
              onClick={() => setNewChatOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
          <Separator />

          <div className="flex gap-2 px-5 py-3">
            <Button
              size="sm"
              variant={mode === "direct" ? "default" : "outline"}
              className="flex-1 rounded-full"
              onClick={() => setMode("direct")}
            >
              Direct
            </Button>
            <Button
              size="sm"
              variant={mode === "group" ? "default" : "outline"}
              className="flex-1 rounded-full"
              onClick={() => setMode("group")}
            >
              Group
            </Button>
          </div>

          {mode === "group" && (
            <div className="space-y-1.5 px-5 pb-3">
              <Label htmlFor="group-name">Group name (optional)</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Japan trip crew"
                maxLength={80}
              />
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={userQuery}
                onChange={(e) => void runUserSearch(e.target.value)}
                placeholder="Find people by name…"
                className="pl-9"
              />
            </div>

            {picked.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {picked.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => togglePicked(user)}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {user.name}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            )}

            <ScrollArea className="mt-3 min-h-0 flex-1">
              <ul className="space-y-1 pb-4">
                {userResults
                  .filter((u) => u.id !== me.id)
                  .map((user) => {
                    const isPicked = picked.some((p) => p.id === user.id);
                    return (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() =>
                            mode === "direct"
                              ? void startDirect(user)
                              : togglePicked(user)
                          }
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                            {user.avatarUrl ? (
                              <Image
                                src={user.avatarUrl}
                                alt=""
                                width={36}
                                height={36}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            ) : (
                              user.name.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {user.name}
                            </span>
                            <span className="block text-xs text-zinc-400">
                              {mode === "group" ? "Tap to add" : "Start a DM"}
                            </span>
                          </span>
                          {isPicked && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
              {userQuery.trim() && userResults.length === 0 && (
                <p className="pb-4 text-center text-sm text-zinc-400">
                  No people found for “{userQuery}”.
                </p>
              )}
            </ScrollArea>
          </div>

          <div className="shrink-0 border-t border-zinc-200 p-4 dark:border-zinc-800">
            {mode === "group" ? (
              <Button
                className="w-full"
                disabled={picked.length === 0 || creating}
                onClick={() => void startGroup()}
              >
                {creating ? "Creating…" : `Create group (${picked.length})`}
              </Button>
            ) : (
              <p className="text-center text-xs text-zinc-400">
                Search for someone and tap their name to start chatting.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}