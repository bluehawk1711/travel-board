"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { ExploreResult } from "@/lib/types";
import { BoardCard } from "./board-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchResults({
  query,
  result,
}: {
  query: string;
  result: ExploreResult;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Search
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Find public boards by destination or title.
      </p>

      <form onSubmit={submit} className="relative mt-5 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “Tokyo”, “beach holiday”, “Japan”…"
          className="rounded-full py-2.5 pl-10 pr-24"
          autoFocus
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full"
        >
          Search
        </Button>
      </form>

      <div className="mt-8">
        {query ? (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            {result.items.length === 0
              ? `No boards match “${query}”.`
              : `${result.items.length} ${
                  result.items.length === 1 ? "board" : "boards"
                } match “${query}”.`}
          </p>
        ) : (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Type above to search public boards.
          </p>
        )}

        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              {query
                ? "Try a different destination, city or board title."
                : "Search for a destination you're dreaming about."}
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {result.items.map((board, index) => (
              <BoardCard key={board.id} board={board} index={index} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}