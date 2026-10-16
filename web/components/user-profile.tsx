"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MessagesSquare, Settings } from "lucide-react";
import {
  fetchUserBoards,
  fetchUserFollowing,
  fetchUserFollowers,
  toggleFollowUser,
} from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { initials } from "@/lib/utils";
import type {
  FollowListResult,
  PublicProfile,
  SearchUser,
  UserBoardsResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { BoardCard } from "./board-card";
import type { FeedItem } from "@/lib/types";

function joinedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Member";
  return `Joined ${date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}

function FollowListModal({
  title,
  data,
  onClose,
}: {
  title: string;
  data: FollowListResult<SearchUser> | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
          {title}{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({data?.total ?? 0})
          </span>
        </h2>
        {data && data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            Nothing here yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(data?.items ?? []).map((user) => (
              <li key={user.id}>
                <Link
                  href={`/u/${user.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.name}
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(user.name)
                    )}
                  </span>
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {user.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function UserProfileView({
  initialProfile,
  initialBoards,
}: {
  initialProfile: PublicProfile;
  initialBoards: UserBoardsResult;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState(initialProfile);
  const [listOpen, setListOpen] = useState<"following" | "followers" | null>(
    null,
  );
  const boards = initialBoards;

  const signedIn = Boolean(getAccessToken());

  // Follow lists load through React Query; enabled only while the modal is open.
  const followingQuery = useQuery({
    queryKey: ["user", profile.id, "following"],
    queryFn: () => fetchUserFollowing(profile.id),
    enabled: listOpen === "following",
  });
  const followersQuery = useQuery({
    queryKey: ["user", profile.id, "followers"],
    queryFn: () => fetchUserFollowers(profile.id),
    enabled: listOpen === "followers",
  });

  const followMutation = useMutation({
    mutationFn: () =>
      toggleFollowUser(profile.id, Boolean(profile.isFollowing)),
    onSuccess: (result) => {
      setProfile((prev) => ({
        ...prev,
        isFollowing: result.following,
        followerCount: result.followerCount,
      }));
      // Follow state affects other users' cached lists too.
      void queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  const handleFollow = () => {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    followMutation.mutate();
  };

  const openList = (kind: "following" | "followers") => {
    setListOpen(kind);
  };

  const feedItems: FeedItem[] = boards.items.map((board) => ({
    id: board.id,
    title: board.title,
    coverImageUrl: board.coverImageUrl,
    destination: board.destination,
    boardType: board.boardType,
    itemCount: board.itemCount,
    likeCount: board.likeCount,
    saveCount: board.saveCount,
    owner: {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    },
    createdAt: board.createdAt,
    startDate: null,
    endDate: null,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-2xl font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.name}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(profile.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {profile.name}
            </h1>
            {profile.isMe ? (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" /> Edit profile
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                variant={profile.isFollowing ? "outline" : "default"}
                className="rounded-full"
                onClick={() => void handleFollow()}
                disabled={followMutation.isPending}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </Button>
            )}
            {!profile.isMe && signedIn && (
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="rounded-full"
              >
                <Link
                  href={`/chat?user=${encodeURIComponent(profile.id)}`}
                  className="flex items-center gap-2"
                >
                  <MessagesSquare className="size-4" /> Message
                </Link>
              </Button>
            )}
          </div>
          {profile.bio && (
            <p className="mt-1.5 max-w-xl leading-relaxed text-zinc-600 dark:text-zinc-300">
              {profile.bio}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500">
            <CalendarDays className="size-3.5" />
            {joinedLabel(profile.createdAt)}
          </p>
          <dl className="mt-3 flex gap-6 text-sm">
            <div>
              <dt className="sr-only">Boards</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.publicBoardCount}
              </dd>
              <dd className="text-zinc-500 dark:text-zinc-400">Boards</dd>
            </div>
            <button
              type="button"
              onClick={() => void openList("followers")}
              className="text-left"
            >
              <dt className="sr-only">Followers</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.followerCount}
              </dd>
              <dd className="text-zinc-500 hover:underline dark:text-zinc-400">
                Followers
              </dd>
            </button>
            <button
              type="button"
              onClick={() => void openList("following")}
              className="text-left"
            >
              <dt className="sr-only">Following</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.followingCount}
              </dd>
              <dd className="text-zinc-500 hover:underline dark:text-zinc-400">
                Following
              </dd>
            </button>
          </dl>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {profile.isMe ? "My public boards" : `Boards by ${profile.name}`}
        </h2>
        {boards.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              {profile.isMe
                ? "You haven't published any public boards yet."
                : "No public boards yet."}
            </p>
            {profile.isMe && (
              <Button asChild className="mt-4 rounded-full">
                <Link href="/onboarding">Plan a trip</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {feedItems.map((board, index) => (
              <BoardCard key={board.id} board={board} index={index} />
            ))}
          </div>
        )}
      </div>

      {listOpen && (
        <FollowListModal
          title={listOpen === "following" ? "Following" : "Followers"}
          data={
            listOpen === "following"
              ? (followingQuery.data ?? null)
              : (followersQuery.data ?? null)
          }
          onClose={() => setListOpen(null)}
        />
      )}
    </main>
  );
}