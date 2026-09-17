/** Mirrors backend `BoardsService.findOne` response + gateway event shapes. */

export interface BoardOwner {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export type BoardItemType =
  | 'PLACE'
  | 'IMAGE'
  | 'NOTE'
  | 'LINK'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'ACTIVITY';

export interface BoardItem {
  id: string;
  boardId: string;
  sectionId: string;
  type: BoardItemType;
  placeId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string | null;
  position: number;
  date: string | null;
  createdAt: string;
}

export interface BoardSection {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  items: BoardItem[];
}

export interface BoardDetail {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: 'ITINERARY' | 'FREEFORM';
  visibility: 'PUBLIC' | 'PRIVATE';
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  owner: BoardOwner;
  sections: BoardSection[];
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  memberCount: number;
  itemCount: number;
  likeCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
}

export type BoardChangeType =
  | 'board:updated'
  | 'board:removed'
  | 'section:created'
  | 'section:updated'
  | 'section:removed'
  | 'item:created'
  | 'item:updated'
  | 'item:removed'
  | 'items:reordered';

/** Server → client `board:change` payload (see backend BoardsGateway). */
export interface BoardChangeEvent {
  type: BoardChangeType;
  boardId: string;
  actorId: string;
  at: string;
  section?: BoardSection;
  sectionId?: string;
  item?: BoardItem;
  itemId?: string;
  orderedItemIds?: string[];
}

export interface BoardPresenceEvent {
  boardId: string;
  activeUserIds: string[];
}

/**
 * Last-write-wins patching of the board detail for a `board:change` event
 * (the same event shape the REST write endpoints broadcast).
 */
export function applyBoardChange(
  board: BoardDetail,
  event: BoardChangeEvent,
): BoardDetail {
  switch (event.type) {
    case 'section:created': {
      if (!event.section) return board;
      return { ...board, sections: [...board.sections, event.section] };
    }
    case 'section:updated': {
      if (!event.section) return board;
      const updated = event.section;
      return {
        ...board,
        sections: board.sections.map((s) =>
          s.id === updated.id ? updated : s,
        ),
      };
    }
    case 'section:removed': {
      return {
        ...board,
        sections: board.sections.filter((s) => s.id !== event.sectionId),
      };
    }
    case 'item:created': {
      if (!event.item) return board;
      const item = event.item;
      return {
        ...board,
        sections: board.sections.map((s) =>
          s.id === item.sectionId ? { ...s, items: [...s.items, item] } : s,
        ),
      };
    }
    case 'item:updated': {
      if (!event.item) return board;
      const item = event.item;
      return {
        ...board,
        sections: board.sections.map((s) => ({
          ...s,
          items: s.items.map((i) => (i.id === item.id ? item : i)),
        })),
      };
    }
    case 'item:removed': {
      return {
        ...board,
        sections: board.sections.map((s) => ({
          ...s,
          items: s.items.filter((i) => i.id !== event.itemId),
        })),
      };
    }
    case 'items:reordered': {
      if (!event.sectionId || !event.orderedItemIds) return board;
      const order = new Map(
        event.orderedItemIds.map((id, index) => [id, index]),
      );
      return {
        ...board,
        sections: board.sections.map((s) =>
          s.id !== event.sectionId
            ? s
            : {
                ...s,
                items: [...s.items].sort(
                  (a, b) =>
                    (order.get(a.id) ?? a.position) -
                    (order.get(b.id) ?? b.position),
                ),
              },
        ),
      };
    }
    default:
      return board;
  }
}