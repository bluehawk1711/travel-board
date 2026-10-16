import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { BoardDetailView } from "@/components/board-detail";
import { ApiError, fetchBoard } from "@/lib/api";

// Cache Components: the board fetch streams at request time behind the
// segment's loading.tsx Suspense boundary; metadata streams with it.

/** Cookie header forwarded to the API so it can authorize private boards. */
async function requestCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const board = await fetchBoard(id, await requestCookieHeader());
    return {
      title: board.title,
      description: board.description ?? undefined,
    };
  } catch {
    return { title: "Board" };
  }
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let board;
  try {
    board = await fetchBoard(id, await requestCookieHeader());
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error; // other failures land in app/error.tsx
  }

  return <BoardDetailView initialBoard={board} />;
}