import type { Metadata } from "next";
import { ChatView } from "@/components/chat-view";

export const metadata: Metadata = {
  title: "Messages",
  description: "Chat with travellers, friends and board collaborators.",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  return <ChatView initialTargetUserId={params.user} />;
}