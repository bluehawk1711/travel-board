import { authFetch } from "./api";
import type { BoardItem, BoardSection } from "./board-types";

/** Mirrors backend `BoardsService.findMine` rows (board + role/counts). */
export interface MyBoard {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: "ITINERARY" | "FREEFORM";
  visibility: "PUBLIC" | "PRIVATE";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  role: "OWNER" | "EDITOR" | "VIEWER" | null;
  memberCount: number;
  itemCount: number;
  likeCount: number;
}

export interface CreateBoardPayload {
  title: string;
  description?: string;
  destination?: string;
  boardType?: "ITINERARY" | "FREEFORM";
  visibility?: "PUBLIC" | "PRIVATE";
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
}

export interface UpdateBoardPayload {
  title?: string;
  description?: string;
  destination?: string;
  boardType?: "ITINERARY" | "FREEFORM";
  visibility?: "PUBLIC" | "PRIVATE";
  startDate?: string | null;
  endDate?: string | null;
  coverImageUrl?: string;
}

export function fetchMyBoards(): Promise<MyBoard[]> {
  return authFetch("/boards/mine");
}

export function createBoard(
  payload: CreateBoardPayload,
): Promise<{ id: string; title: string }> {
  return authFetch("/boards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBoard(
  id: string,
  payload: UpdateBoardPayload,
): Promise<{ id: string }> {
  return authFetch(`/boards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createSection(boardId: string, title: string): Promise<BoardSection> {
  return authFetch(`/boards/${boardId}/sections`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function updateSection(
  sectionId: string,
  payload: { title?: string; position?: number },
): Promise<BoardSection> {
  return authFetch(`/boards/sections/${sectionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSection(sectionId: string): Promise<{ success: boolean }> {
  return authFetch(`/boards/sections/${sectionId}`, { method: "DELETE" });
}

export function createItem(
  boardId: string,
  payload: {
    type: BoardItem["type"];
    sectionId: string;
    title: string;
    description?: string;
    url?: string;
  },
): Promise<BoardItem> {
  return authFetch(`/boards/${boardId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateItem(
  itemId: string,
  payload: { title?: string; description?: string; url?: string },
): Promise<BoardItem> {
  return authFetch(`/boards/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteItem(itemId: string): Promise<{ success: boolean }> {
  return authFetch(`/boards/items/${itemId}`, { method: "DELETE" });
}

export function reorderBoardItems(
  boardId: string,
  sectionId: string,
  orderedItemIds: string[],
): Promise<{ success: boolean }> {
  return authFetch(`/boards/${boardId}/items/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ sectionId, orderedItemIds }),
  });
}