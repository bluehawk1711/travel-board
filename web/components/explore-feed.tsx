"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FEED_PAGE_SIZE } from "@/lib/api";
import type { ExploreResult, FeedSort } from "@/lib/types";
import { BoardCard } from "./board-card";
import { ExplorePlanner, EMPTY_FILTER, type ExploreFilter } from "./explore-plan";
import { TripChecklist } from "./trip-checklist";
import { FeaturedDestination } from "./featured-destination";
import { HowItWorks } from "./how-it-works";

function SortLink({
  label,
  sort,
  active,
}: {
  label: string;
  sort: FeedSort;
  active: boolean;
}) {
  return (
    <Link
      href={`/?sort=${sort}`}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-black"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}

function overlapsRange(
  startDate: string | null,
  endDate: string | null,
  range: { from?: Date; to?: Date } | null,
): boolean {
  if (!range?.from || !range.to) return true;
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : start;
  // Boards without dates don't conflict with a date filter.
  if (start == null || end == null) return true;
  const from = range.from.getTime();
  const to = range.to.getTime();
  return end >= from && start <= to;
}

export function ExploreFeed({
  feed,
  sort,
  page,
}: {
  feed: ExploreResult;
  sort: FeedSort;
  page: number;
}) {
  const [filter, setFilter] = useState<ExploreFilter>(EMPTY_FILTER);

  const filtered = useMemo(
    () =>
      feed.items.filter((board) => {
        if (filter.destination) {
          const q = filter.destination.toLowerCase();
          const destination = board.destination?.toLowerCase() ?? "";
          const title = board.title.toLowerCase();
          if (!destination.includes(q) && !title.includes(q)) return false;
        }
        if (!overlapsRange(board.startDate, board.endDate, filter.dateRange)) {
          return false;
        }
        return true;
      }),
    [feed.items, filter],
  );

  const hasFilter = Boolean(filter.destination || filter.dateRange?.from);
  const hero = useMemo(
    () =>
      filtered.find((board) => board.coverImageUrl && board.destination) ??
      filtered.find((board) => board.coverImageUrl),
    [filtered],
  );

  const hasPrev = page > 1;
  const hasNext = feed.hasMore;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Explore
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Discover travel boards from the community
          </p>
        </div>
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center gap-3"
        >
          <Link
            href="/boards"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            My boards
          </Link>
          <Link
            href="/onboarding"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            Plan a trip
          </Link>
          <div className="flex gap-2">
            <SortLink label="Newest" sort="newest" active={sort === "newest"} />
            <SortLink
              label="Trending"
              sort="trending"
              active={sort === "trending"}
            />
          </div>
        </nav>
      </header>

      {/* Plan a trip: destination search + date range + checklist */}
      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <ExplorePlanner
          items={feed.items}
          value={filter}
          onChange={setFilter}
        />
        <TripChecklist />
      </div>

      {/* Featured destination hero */}
      {!hasFilter && hero && (
        <div className="mb-8">
          <FeaturedDestination board={hero} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            {hasFilter
              ? "No boards match that destination or date range."
              : "No boards here yet — be the first to create one."}
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
              className="mt-3 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {filtered.map((board, index) => (
            <BoardCard key={board.id} board={board} index={index} />
          ))}
        </div>
      )}

      <nav
        aria-label="Pagination"
        className="mt-10 flex items-center justify-center gap-3"
      >
        {hasFilter ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing {filtered.length} of {feed.items.length} loaded boards ·
            filters apply to the loaded feed
          </span>
        ) : (
          <>
            {hasPrev && (
              <Link
                href={`/?sort=${sort}&page=${page - 1}`}
                className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← Previous
              </Link>
            )}
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Page {page} · {(page - 1) * FEED_PAGE_SIZE + feed.items.length}{" "}
              boards
            </span>
            {hasNext && (
              <Link
                href={`/?sort=${sort}&page=${page + 1}`}
                className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Next →
              </Link>
            )}
          </>
        )}
      </nav>

      <HowItWorks />
    </main>
  );
}