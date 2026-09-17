"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rss } from "lucide-react";
import { fetchFollowingFeed } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { ExploreResult } from "@/lib/types";
import { BoardCard } from "./board-card";
import { Button } from "@/components/ui/button";

export function FollowingFeed() {
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    setSignedIn(true);
    let cancelled = false;
    void fetchFollowingFeed(24, 0)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult({ items: [], hasMore: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <Rss className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Following
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Boards from the travellers you follow.
          </p>
        </div>
      </div>

      {!signedIn ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Sign in to see boards from people you follow.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="mt-10 text-center text-sm text-zinc-400">
          Loading your feed…
        </div>
      ) : result && result.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Nothing here yet — follow some travellers to fill this feed.
          </p>
          <Button asChild size="sm" className="mt-4 rounded-full">
            <Link href="/">Explore boards</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {(result?.items ?? []).map((board, index) => (
            <BoardCard key={board.id} board={board} index={index} />
          ))}
        </div>
      )}
    </main>
  );
}