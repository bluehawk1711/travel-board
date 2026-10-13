"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/api";
import { queryKeys, useNotifications } from "@/lib/queries";
import type { NotificationItem } from "@/lib/types";
import { UI_MESSAGES } from "@travel-board/shared";

const PAGE_SIZE = 30;

function timeAgo(iso: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w ago`;
  return `${Math.floor(weeks / 52)}y ago`;
}

/** One-line sentence per type (mirrors backend push copy). */
function notificationSentence(item: NotificationItem): string {
  const name = item.actor.name;
  const boardTitle =
    typeof item.metadata?.["boardTitle"] === "string"
      ? (item.metadata["boardTitle"] as string)
      : null;
  const excerpt =
    typeof item.metadata?.["excerpt"] === "string"
      ? (item.metadata["excerpt"] as string)
      : null;

  switch (item.type) {
    case "NEW_FOLLOWER":
      return `${name} started following you`;
    case "NEW_BOARD_FOLLOWER":
      return boardTitle
        ? `${name} is now following ${boardTitle}`
        : `${name} is following one of your boards`;
    case "NEW_COMMENT":
      return boardTitle
        ? `${name} commented on ${boardTitle}`
        : `${name} left a comment`;
    case "NEW_LIKE":
      return boardTitle
        ? `${name} liked ${boardTitle}`
        : `${name} liked something of yours`;
    case "NEW_SAVE":
      return boardTitle
        ? `${name} saved ${boardTitle}`
        : `${name} saved something of yours`;
    case "NEW_CHAT_MESSAGE":
      return excerpt ?? "You have a new message";
    case "MENTION":
    default:
      return `${name} mentioned you`;
  }
}

/** Destination for a tapped notification (web routes). */
function notificationHref(item: NotificationItem): string | null {
  switch (item.type) {
    case "NEW_FOLLOWER":
      return `/u/${item.actor.id}`;
    case "NEW_CHAT_MESSAGE":
      // ChatView opens the shared conversation containing this member.
      return `/chat?user=${item.actor.id}`;
    case "NEW_BOARD_FOLLOWER":
    case "NEW_COMMENT":
    case "NEW_LIKE":
    case "NEW_SAVE":
      return item.targetId ? `/boards/${item.targetId}` : null;
    default:
      return null;
  }
}

export function NotificationsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications();
  const items = data?.items ?? [];
  const hasUnread = items.some((item) => !item.read);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.unreadNotifications,
    });
  };

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });

  const handleTap = (item: NotificationItem) => {
    if (!item.read) {
      markReadMutation.mutate([item.id]);
    }
    const href = notificationHref(item);
    if (href) {
      router.push(href);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Notifications
        </h1>
        {hasUnread ? (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            {UI_MESSAGES.NOTIFICATIONS.MARK_ALL_READ}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {UI_MESSAGES.NOTIFICATIONS.EMPTY}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => {
            const row = (
              <>
                <Avatar className="size-10 shrink-0">
                  {item.actor.avatarUrl ? (
                    <AvatarImage src={item.actor.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    {item.actor.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      item.read
                        ? "text-sm text-zinc-600 dark:text-zinc-400"
                        : "text-sm font-medium text-zinc-900 dark:text-zinc-50"
                    }
                  >
                    {notificationSentence(item)}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
                {!item.read ? (
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                ) : null}
              </>
            );

            const href = notificationHref(item);
            return (
              <li key={item.id}>
                {href ? (
                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-3 px-2 py-3">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
