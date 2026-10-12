import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreFeed } from "@/components/explore-feed";
import { FEED_PAGE_SIZE, fetchExploreFeed } from "@/lib/api";
import type { FeedSort } from "@/lib/types";
import { APP, UI_MESSAGES } from "@travel-board/shared";

// Cache Components (PPR) is enabled: the page shell prerenders, and the feed
// streams in at request time behind <Suspense>. `next build` must never depend
// on the API being up, and the API already serves its own 60s Redis-cached feed.

export const metadata: Metadata = {
  title: UI_MESSAGES.EXPLORE.TITLE,
  description: UI_MESSAGES.EXPLORE.DESCRIPTION,
};

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<ExploreFeedSkeleton />}>
      <ExploreFeedContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ExploreFeedContent({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort: FeedSort = params.sort === "trending" ? "trending" : "newest";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const feed = await fetchExploreFeed(sort, FEED_PAGE_SIZE, (page - 1) * FEED_PAGE_SIZE);

  return <ExploreFeed feed={feed} sort={sort} page={page} />;
}

function ExploreFeedSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-6 h-9 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="mb-4 break-inside-avoid">
            <div
              className="w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
              style={{ aspectRatio: i % 3 === 0 ? "3 / 4" : "4 / 3" }}
            />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
