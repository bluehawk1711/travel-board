import type { Metadata } from "next";
import { ExploreFeed } from "@/components/explore-feed";
import { FEED_PAGE_SIZE, fetchExploreFeed } from "@/lib/api";
import type { FeedSort } from "@/lib/types";

// Render at request time: `next build` must never depend on the API being up,
// and the API already serves its own 60s Redis-cached feed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore — Travel Boards",
  description:
    "Discover travel boards from the community — itineraries and collections to save and collaborate on.",
};

export default async function HomePage({
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