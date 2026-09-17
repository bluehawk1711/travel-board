"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { fetchMyBoards, type MyBoard } from "@/lib/board-edit";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import FloatingPill from "@/components/shadcn-space/pagination/pagination-01";

const PAGE_SIZE = 12;

function MyBoardCard({ board }: { board: MyBoard }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="group block break-inside-avoid rounded-2xl"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
        {board.coverImageUrl ? (
          <Image
            src={board.coverImageUrl}
            alt={board.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 p-3">
            <span className="truncate text-lg font-semibold text-white drop-shadow">
              {board.destination ?? board.title}
            </span>
          </div>
        )}
        {board.visibility === "PRIVATE" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            Private
          </span>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 font-medium leading-snug text-zinc-900 dark:text-zinc-50">
        {board.title}
      </h3>
      {board.destination && (
        <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
          {board.destination}
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {board.itemCount} {board.itemCount === 1 ? "item" : "items"} ·{" "}
        {board.role?.toLowerCase() ?? "member"}
      </p>
    </Link>
  );
}

export default function MyBoardsPage() {
  const [boards, setBoards] = useState<MyBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchMyBoards()
      .then((data) => {
        if (!cancelled) setBoards(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Couldn't load your boards.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = boards ? Math.max(1, Math.ceil(boards.length / PAGE_SIZE)) : 1;
  const pageItems = useMemo(
    () => boards?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [],
    [boards, page],
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            My Boards
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Boards you own or collaborate on.
          </p>
        </div>
        <Link href="/boards/new">
          <Button className="cursor-pointer">
            <Plus /> New board
          </Button>
        </Link>
      </header>

      {error ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">{error}</p>
          <p className="mt-2 text-xs text-zinc-400">
            Make sure you&apos;re signed in (Google OAuth via the API).
          </p>
        </div>
      ) : boards === null ? (
        <div className="py-20 text-center text-sm text-zinc-500">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            You don&apos;t have any boards yet.
          </p>
          <Link href="/boards/new" className="mt-3 inline-block">
            <Button className="cursor-pointer">Create your first board</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {pageItems.map((board) => (
              <MyBoardCard key={board.id} board={board} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <FloatingPill
                current={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}