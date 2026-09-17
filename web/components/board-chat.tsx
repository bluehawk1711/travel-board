"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Users, X } from "lucide-react";
import {
  fetchMe,
  getBoardConversation,
  listMessages,
  sendChatMessage,
} from "@/lib/api";
import type { ChatMessage, ConversationDetail } from "@/lib/chat-types";
import { getBoardSocket } from "@/lib/socket";
import type { BoardDetail } from "@/lib/board-types";
import ChatContent from "@/components/shadcn-space/radix/blocks/chat-application-01/chat-content";
import ChatMsgSent from "@/components/shadcn-space/radix/blocks/chat-application-01/chat-msgsent";
import type { Chat } from "@/components/shadcn-space/radix/blocks/chat-application-01/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BoardChatProps {
  board: BoardDetail;
  onClose: () => void;
}

function toChatView(
  conversation: ConversationDetail,
  messages: ChatMessage[],
  myAvatarUrl: string | null,
): Chat {
  return {
    id: conversation.id,
    name: conversation.name ?? "Trip chat",
    thumb: myAvatarUrl ?? "",
    status: "online",
    excerpt: `${conversation.members.length} members`,
    messages,
    members: conversation.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
    })),
  };
}

export function BoardChat({ board, onClose }: BoardChatProps) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadedOlder, setLoadedOlder] = useState(false);

  // Holds the socket so unmount can leave the room cleanly.
  const liveRef = useRef<{ socket: Socket; remove: () => void } | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const boot = useCallback(async () => {
    // Defer past the effect's synchronous phase (set-state-in-effect rule).
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const [me, conv] = await Promise.all([
        fetchMe(),
        getBoardConversation(board.id),
      ]);
      setCurrentUserId(me.user.id);
      setMyAvatarUrl(me.user.avatarUrl);
      setConversation(conv);
      conversationIdRef.current = conv.id;
      const page = await listMessages(conv.id);
      setMessages(page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);

      // Live: join the room, append broadcast messages.
      const socket = await getBoardSocket();
      socket.emit(
        "conversation:join",
        { conversationId: conv.id },
        () => undefined,
      );
      const onNew = (payload: ChatMessage & { clientId?: string }) => {
        if (payload.conversationId !== conversationIdRef.current) return;
        const exists = messagesRef.current.some((m) => m.id === payload.id);
        if (!exists) {
          const message: ChatMessage = {
            id: payload.id,
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            senderName: payload.senderName,
            senderAvatarUrl: payload.senderAvatarUrl,
            body: payload.body,
            createdAt: payload.createdAt,
          };
          setMessages((prev) => [...prev, message]);
        }
      };
      socket.on("message:new", onNew);
      liveRef.current = {
        socket,
        remove: () => socket.off("message:new", onNew),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the chat");
    } finally {
      setLoading(false);
    }
  }, [board.id]);

  useEffect(() => {
    // Defer so no setState runs during the effect's synchronous phase.
    const timer = setTimeout(() => void boot(), 0);
    return () => {
      clearTimeout(timer);
      liveRef.current?.remove();
      liveRef.current = null;
      conversationIdRef.current = null;
    };
  }, [boot]);

  const loadOlder = useCallback(async () => {
    if (!conversation || !nextCursor || loadedOlder) return;
    setLoadedOlder(true);
    try {
      const page = await listMessages(conversation.id, nextCursor);
      setMessages((prev) => [...page.items, ...prev]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadedOlder(false);
    }
  }, [conversation, nextCursor, loadedOlder]);

  const handleSend = useCallback(
    async (conversationId: string, body: string) => {
      setSending(true);
      try {
        // Sockets are the preferred path; REST is the durable fallback.
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
        // Socket unavailable/rejected → REST fallback (never lose a message).
        const message = await sendChatMessage(conversationId, body);
        setMessages((prev) =>
          prev.some((m) => m.id === message.id)
            ? prev
            : [...prev, message],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const view = useMemo(
    () =>
      conversation ? toChatView(conversation, messages, myAvatarUrl) : null,
    [conversation, messages, myAvatarUrl],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">Trip chat</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {board.title} · {conversation?.members.length ?? board.memberCount}{" "}
            members
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer"
          onClick={onClose}
          aria-label="Close chat"
        >
          <X className="size-4" />
        </Button>
      </div>
      <Separator />

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Opening chat…
        </div>
      ) : error && !conversation ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void boot()}
          >
            Retry
          </Button>
        </div>
      ) : view ? (
        <>
          <div className="min-h-0 flex-1">
            <ChatContent
              selectedChat={view}
              currentUserId={currentUserId}
              onClickMobile={() => undefined}
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
            {error && conversation ? (
              <p className="px-5 pb-1 text-xs text-destructive">{error}</p>
            ) : null}
            <Separator />
            <ChatMsgSent
              selectedChat={view}
              sending={sending}
              onSendMessage={(conversationId, body) =>
                void handleSend(conversationId, body)
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}