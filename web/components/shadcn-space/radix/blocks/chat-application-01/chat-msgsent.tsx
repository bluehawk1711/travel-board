"use client";
import { Input } from "@/components/ui/input";
import { ChangeEvent, SubmitEvent, useState } from "react";
import { Send } from "lucide-react";
import { Chat } from "@/components/shadcn-space/radix/blocks/chat-application-01/types";

type Props = {
  selectedChat: Chat | null;
  onSendMessage: (chatId: string, message: string) => void;
  /** Disables the composer while a message is being persisted. */
  sending?: boolean;
  /** Broadcast a typing indicator (parent throttles). */
  onTyping?: () => void;
};

const ChatMsgSent = ({
  selectedChat,
  onSendMessage,
  sending = false,
  onTyping,
}: Props) => {
  const [msg, setMsg] = useState<string>("");

  const handleChatMsgChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMsg(e.target.value);
    if (e.target.value.trim()) {
      onTyping?.();
    }
  };

  const onChatMsgSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!msg.trim() || !selectedChat || sending) return;
    onSendMessage(selectedChat.id, msg.trim());
    setMsg("");
  };

  return (
    <>
      <form onSubmit={onChatMsgSubmit}>
        <div className="flex items-center gap-3 px-5 py-2">
          <div className="flex-1 min-w-0">
            <Input
              className="border-0 shadow-none"
              required
              value={msg}
              onChange={handleChatMsgChange}
              placeholder="Type here"
              disabled={sending}
            />
          </div>
          <button
            type="submit"
            disabled={sending || !msg.trim()}
            className="h-9 w-9 flex shrink-0 justify-center items-center rounded-lg hover:bg-primary/5 hover:text-primary cursor-pointer bg-transparent disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size="20" />
          </button>
        </div>
      </form>
    </>
  );
};

export default ChatMsgSent;
