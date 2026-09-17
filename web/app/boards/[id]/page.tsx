import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardDetailView } from "@/components/board-detail";
import { ApiError, fetchBoard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const board = await fetchBoard(id);
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
    board = await fetchBoard(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error; // other failures land in app/error.tsx
  }

  return <BoardDetailView initialBoard={board} />;
}