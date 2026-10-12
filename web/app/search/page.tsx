import type { Metadata } from "next";
import { fetchExploreFeed } from "@/lib/api";
import { SearchResults } from "@/components/search-results";
import { UI_MESSAGES } from "@travel-board/shared";

// Cache Components: `searchParams` + the optional feed fetch stream at request
// time behind the segment's loading.tsx Suspense boundary.

export const metadata: Metadata = {
  title: "Search",
  description: UI_MESSAGES.SEARCH.DESCRIPTION,
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const result = query
    ? await fetchExploreFeed("newest", 24, 0, query)
    : { items: [], hasMore: false };
  return <SearchResults query={query} result={result} />;
}