export type ChatStatus = "online" | "offline" | "busy" | "away";

/**
 * Backend `MessagePayload` (serialized over the wire) — see
 * backend/src/chat/chat.service.ts.
 */
export interface ChatMessage {
  id: number;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface ChatMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/** View-model for one open conversation thread rendered by ChatContent. */
export interface Chat {
  id: string;
  name: string;
  thumb: string;
  status: ChatStatus;
  excerpt: string;
  messages: ChatMessage[];
  members: ChatMember[];
}

/** Id used for the current logged-in user when sending a message. */
export const CURRENT_USER_ID = "me";