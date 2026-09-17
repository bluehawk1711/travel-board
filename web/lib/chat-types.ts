/** Mirrors backend `ChatService` payloads (backend/src/chat/chat.service.ts). */

export interface ChatMessage {
  id: number;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface ConversationMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface ConversationDetail {
  id: string;
  type: "DIRECT" | "GROUP" | "BOARD";
  boardId: string | null;
  name: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
}

export interface MessagePage {
  items: ChatMessage[];
  hasMore: boolean;
  nextCursor: number | null;
}

/** One row in the conversation list (`ChatService.listConversations`). */
export interface ConversationSummary {
  id: string;
  type: "DIRECT" | "GROUP" | "BOARD";
  boardId: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

/** Human-readable label for a conversation row. */
export function conversationTitle(
  conversation: Pick<ConversationSummary, "type" | "name" | "members">,
  meId?: string,
): string {
  if (conversation.name) {
    return conversation.name;
  }
  if (conversation.type === "DIRECT") {
    const other = conversation.members.find((m) => m.userId !== meId);
    return other?.name ?? "Direct message";
  }
  if (conversation.type === "BOARD") {
    return "Board chat";
  }
  return conversation.members
    .filter((m) => m.userId !== meId)
    .map((m) => m.name)
    .slice(0, 3)
    .join(", ") || "Group chat";
}

export interface ChatPresence {
  [userId: string]: boolean;
}