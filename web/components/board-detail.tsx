"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { Bookmark, Copy, Home, Images, MessagesSquare, Pencil, Trash2, Users } from "lucide-react";
import { UI_MESSAGES } from "@travel-board/shared";
import { copyBoard, deleteBoard, fetchBoard, toggleBoardLike, toggleBoardSave, uploadImage } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { updateBoard } from "@/lib/board-edit";
import {
  applyBoardChange,
  type BoardChangeEvent,
  type BoardDetail,
  type BoardItem,
  type BoardPresenceEvent,
} from "@/lib/board-types";
import { getBoardSocket } from "@/lib/socket";
import { queryKeys } from "@/lib/queries";
import { cn, initials } from "@/lib/utils";
import AnimatedLikeButton from "@/components/shadcn-space/button/button-20";
import EventCard from "@/components/shadcn-space/card/card-24";
import CalendarWithEvents from "@/components/shadcn-space/calendar/calendar-08";
import {
  AppleDock,
  AppleDockIcon,
} from "@/components/shadcn-space/apple-dock/apple-dock-01";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { BoardChat } from "./board-chat";
import { BoardEditor } from "./board-editor";
import { BoardMembers } from "./board-members";

function ItemCard({ item }: { item: BoardItem }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {item.imageUrl && (
        <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 90vw, 600px"
            className="object-cover"
          />
        </div>
      )}
      <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
        {item.title}
      </h4>
      {item.description && (
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {item.description}
        </p>
      )}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          {item.url.replace(/^https?:\/\//, "").slice(0, 40)}
        </a>
      )}
    </div>
  );
}

function formatTripDate(iso: string | null): { month: string; day: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    month: date
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase(),
    day: String(date.getDate()),
  };
}

export function BoardDetailView({
  initialBoard,
}: {
  initialBoard: BoardDetail;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const boardKey = queryKeys.board(initialBoard.id);

  // Board detail lives in the React Query cache; socket events, the editor and
  // the like/save mutations all write through it, so every surface (stats row,
  // dock, editor) reads one source of truth.
  const { data: board } = useQuery({
    queryKey: boardKey,
    queryFn: () => fetchBoard(initialBoard.id),
    initialData: initialBoard,
  });

  /** Write-through cache setter (accepts a value or an updater function). */
  const setBoard = useCallback(
    (update: BoardDetail | ((prev: BoardDetail) => BoardDetail)) => {
      queryClient.setQueryData<BoardDetail>(boardKey, (prev) =>
        prev ? (typeof update === "function" ? update(prev) : update) : prev,
      );
    },
    [queryClient, boardKey],
  );

  const [joined, setJoined] = useState(false);
  const [editors, setEditors] = useState<string[]>([]);
  const [deleted, setDeleted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  // Like/save/cover/delete are mutations that write through the cache, with an
  // optimistic flip on like/save and rollback if the request fails.
  const likeMutation = useMutation({
    mutationFn: () => toggleBoardLike(board.id),
    onMutate: () => {
      const previous = queryClient.getQueryData<BoardDetail>(boardKey);
      if (previous) {
        setBoard({
          ...previous,
          liked: !previous.liked,
          likeCount: Math.max(
            0,
            previous.likeCount + (previous.liked ? -1 : 1),
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        setBoard(context.previous);
      }
    },
    onSuccess: (result) => {
      setBoard((prev) => ({
        ...prev,
        liked: result.liked,
        likeCount: result.likeCount,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => toggleBoardSave(board.id),
    onMutate: () => {
      const previous = queryClient.getQueryData<BoardDetail>(boardKey);
      if (previous) {
        setBoard({
          ...previous,
          saved: !previous.saved,
          saveCount: Math.max(
            0,
            previous.saveCount + (previous.saved ? -1 : 1),
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        setBoard(context.previous);
      }
    },
    onSuccess: (result) => {
      setBoard((prev) => ({
        ...prev,
        saved: result.saved,
        saveCount: result.saveCount,
      }));
    },
  });

  const coverMutation = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await uploadImage(file);
      await updateBoard(board.id, { coverImageUrl: url });
      return url;
    },
    onSuccess: (url) => {
      setBoard((prev) => ({ ...prev, coverImageUrl: url }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBoards });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBoard(board.id),
    onSuccess: () => {
      setDeleted(true);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBoards });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.followingFeed,
      });
    },
  });

  // "Copy board" — non-members duplicate a public board into their own boards
  // (the copy starts private). Redirects to the fresh copy for editing.
  const copyMutation = useMutation({
    mutationFn: () => copyBoard(board.id),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBoards });
      router.push(`/boards/${copy.id}`);
    },
  });

  const handleCopy = () => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    copyMutation.mutate();
  };

  const liked = board.liked;
  const likeCount = board.likeCount;
  const saved = board.saved;
  const saveCount = board.saveCount;
  const uploadingCover = coverMutation.isPending;

  // Holds the socket + subscribed handlers so unmount can leave cleanly.
  const liveRef = useRef<{
    socket: Socket;
    handlers: { event: string; remove: () => void }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    getBoardSocket()
      .then((socket) => {
        if (cancelled) {
          return;
        }
        socket.emit(
          "board:join",
          { boardId: board.id },
          (res: { ok: boolean }) => {
            if (!cancelled && res?.ok) {
              setJoined(true);
            }
          },
        );

        const onChange = (event: BoardChangeEvent) => {
          if (event.type === "board:removed") {
            setDeleted(true);
            return;
          }
          if (event.type === "board:updated") {
            void queryClient.invalidateQueries({ queryKey: boardKey });
            return;
          }
          setBoard((prev) => applyBoardChange(prev, event));
        };
        const onPresence = (payload: BoardPresenceEvent) => {
          setEditors(payload.activeUserIds);
        };

        socket.on("board:change", onChange);
        socket.on("board:presence", onPresence);
        liveRef.current = {
          socket,
          handlers: [
            {
              event: "board:change",
              remove: () => socket.off("board:change", onChange),
            },
            {
              event: "board:presence",
              remove: () => socket.off("board:presence", onPresence),
            },
          ],
        };
      })
      .catch(() => {
        // Not signed in (or socket rejected) — static view is fine.
      });

    return () => {
      cancelled = true;
      const live = liveRef.current;
      liveRef.current = null;
      if (!live) {
        return;
      }
      live.socket.emit("board:leave", { boardId: board.id });
      for (const h of live.handlers) {
        h.remove();
      }
    };
  }, [boardKey, board.id, queryClient, setBoard]);

  const handleLike = () => {
    // Optimistic flip lives inside the mutation; the animated button reflects
    // the cached board so it stays in sync with the stats row.
    likeMutation.mutate();
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this board? This cannot be undone.",
      )
    ) {
      return;
    }
    deleteMutation.mutate();
  };

  const handleCoverUpload = useCallback(
    (file: File) => {
      coverMutation.mutate(file);
    },
    [coverMutation],
  );

  const tripStart = formatTripDate(board.startDate);
  const tripDays =
    board.startDate && board.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(board.endDate).getTime() -
              new Date(board.startDate).getTime()) /
              86_400_000,
          ) + 1,
        )
      : null;

  const calendarEvents = useMemo(() => {
    const events: {
      title: string;
      from: string;
      to: string;
      color: "teal" | "orange";
    }[] = [];
    if (board.startDate) {
      events.push({
        title: "Trip starts",
        from: board.startDate,
        to: board.startDate,
        color: "teal",
      });
    }
    if (board.endDate) {
      events.push({
        title: "Trip ends",
        from: board.endDate,
        to: board.endDate,
        color: "orange",
      });
    }
    return events;
  }, [board.startDate, board.endDate]);

  if (deleted) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          This board was deleted
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          It was removed by a collaborator while you were viewing it.
        </p>
      </main>
    );
  }

  const stats = [
    { label: "items", value: board.itemCount },
    { label: "likes", value: likeCount },
    { label: "saves", value: saveCount },
    { label: "members", value: board.memberCount },
  ];

  const showTripWidgets = Boolean(
    calendarEvents.length > 0 || board.boardType === "ITINERARY",
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-28">
      {/* Cover */}
      <div
        className="group relative h-56 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 sm:h-72"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith("image/")) {
            void handleCoverUpload(file);
          }
        }}
      >
        {board.coverImageUrl && (
          <Image
            src={board.coverImageUrl}
            alt={board.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
          />
        )}
        {/* Cover upload overlay */}
        {(board.role === "OWNER" || board.role === "EDITOR") && (
          <label
            className={`absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/0 transition-colors hover:bg-black/20 ${
              uploadingCover ? "pointer-events-none" : ""
            }`}
          >
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Images className="size-3.5" />
              {uploadingCover ? "Uploading…" : "Change cover"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingCover}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCoverUpload(file);
              }}
            />
          </label>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {board.title}
          </h1>
          {board.destination && (
            <p className="text-sm text-white/80">{board.destination}</p>
          )}
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          {board.boardType === "ITINERARY" && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              Itinerary
            </span>
          )}
          {board.visibility === "PRIVATE" && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              Private
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            {board.owner.avatarUrl ? (
              <Image
                src={board.owner.avatarUrl}
                alt={board.owner.name}
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(board.owner.name)
            )}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {board.owner.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {board.role
                ? UI_MESSAGES.BOARDS.yourRole(board.role)
                : UI_MESSAGES.BOARDS.PUBLIC_BOARD_LABEL}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
          {stats.map((s) => (
            <span key={s.label} className="text-center">
              <span className="block font-semibold">{s.value}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {s.label}
              </span>
            </span>
          ))}
          <AnimatedLikeButton
            liked={liked}
            count={likeCount}
            onToggle={() => handleLike()}
            label={`Like ${board.title}`}
          />
        </div>
      </div>

      {/* Live indicator + copy feedback */}
      <div className="mt-4 flex h-6 items-center gap-2">
        {joined && (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {editors.length > 0
                ? `Live · ${editors.length} ${editors.length === 1 ? "person" : "people"} viewing`
                : "Live"}
            </span>
          </>
        )}
        {copyMutation.isPending && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Copying board…
          </span>
        )}
        {copyMutation.isError && (
          <span role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {copyMutation.error.message}
          </span>
        )}
      </div>

      {/* Description */}
      {board.description && (
        <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-300">
          {board.description}
        </p>
      )}

      {/* Trip at a glance: itinerary summary + calendar */}
      {showTripWidgets && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <EventCard
            className="sm:max-w-none"
            category={board.boardType === "ITINERARY" ? "Itinerary" : "Collection"}
            title={board.destination ?? board.title}
            description={board.description ?? undefined}
            image={board.coverImageUrl ?? undefined}
            month={tripStart?.month}
            day={tripStart?.day}
            time={
              tripDays
                ? `${tripDays} ${tripDays === 1 ? "day" : "days"} · ${board.startDate ? new Date(board.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}${board.endDate ? ` – ${new Date(board.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                : undefined
            }
            location={board.destination ?? undefined}
            attendees={[]}
            attendeeCount={board.memberCount}
            ctaLabel="Members"
          />
          <div className="rounded-2xl border border-border bg-card p-4">
            <CalendarWithEvents
              events={calendarEvents}
              initialDate={
                board.startDate ? new Date(board.startDate) : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editing ? (
        <BoardEditor
          board={board}
          onChange={setBoard}
          onExit={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Sections + items */}
          {board.sections.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
              <p className="text-zinc-500 dark:text-zinc-400">
                This board has no sections yet.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {board.sections.map((section) => (
                <section key={section.id}>
                  <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {section.title}
                  </h2>
                  {section.items.length === 0 ? (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">
                      No items in this section.
                    </p>
                  ) : (
                    <div className="columns-1 gap-4 sm:columns-2">
                      {section.items.map((item) => (
                        <div key={item.id} className="mb-4">
                          <ItemCard item={item} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-10 text-center text-xs text-zinc-400 dark:text-zinc-600">
        <Link href="/" className="underline">
          ← Back to explore
        </Link>
      </p>

      {/* Quick actions dock (hidden while editing — the editor has its own controls) */}
      {!editing && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
          <AppleDock iconMagnification={52} iconDistance={120}>
            <AppleDockIcon
              className="bg-sky-500/10 text-sky-500"
              aria-label="Back to explore"
              onClick={() => router.push("/")}
            >
              <Home className="size-5" />
            </AppleDockIcon>
            <AppleDockIcon
              className={cn(
                "bg-amber-400/10",
                saved ? "text-amber-400" : "text-amber-400/70",
              )}
              aria-label={saved ? "Unsave board" : "Save board"}
              onClick={() => void handleSave()}
            >
              <Bookmark
                className="size-5"
                fill={saved ? "currentColor" : "none"}
              />
            </AppleDockIcon>
            {!board.role && (
              <AppleDockIcon
                className="bg-rose-400/10 text-rose-400/80"
                aria-label="Copy board to my boards"
                onClick={() => void handleCopy()}
              >
                <Copy className="size-5" />
              </AppleDockIcon>
            )}
            {(board.role === "OWNER" || board.role === "EDITOR") && (
              <AppleDockIcon
                className="bg-violet-500/10 text-violet-500"
                aria-label="Edit board"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-5" />
              </AppleDockIcon>
            )}
            {board.role && (
              <AppleDockIcon
                className={cn(
                  "bg-teal-400/10",
                  chatOpen ? "text-teal-400" : "text-teal-400/70",
                )}
                aria-label="Open trip chat"
                onClick={() => setChatOpen(true)}
              >
                <MessagesSquare className="size-5" />
              </AppleDockIcon>
            )}
            {board.role && (
              <AppleDockIcon
                className={cn(
                  "bg-sky-400/10",
                  membersOpen ? "text-sky-400" : "text-sky-400/70",
                )}
                aria-label="Board members"
                onClick={() => setMembersOpen(true)}
              >
                <Users className="size-5" />
              </AppleDockIcon>
            )}
            {board.role === "OWNER" && (
              <AppleDockIcon
                className="bg-red-500/10 text-red-500/70"
                aria-label="Delete board"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="size-5" />
              </AppleDockIcon>
            )}
          </AppleDock>
        </div>
      )}

      {/* Board chat (board members only) */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="p-0" showCloseButton={false}>

          <SheetTitle className="sr-only">Trip chat</SheetTitle>
          {board.role && (
            <BoardChat board={board} onClose={() => setChatOpen(false)} />
          )}
        </SheetContent>
      </Sheet>

      {/* Board members management */}
      <BoardMembers
        boardId={board.id}
        isOwner={board.role === "OWNER"}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
    </main>
  );
}