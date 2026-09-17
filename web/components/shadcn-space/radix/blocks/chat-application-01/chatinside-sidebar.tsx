import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { Chat } from "@/components/shadcn-space/radix/blocks/chat-application-01/types";

type Props = {
  selectedChat: Chat | null;
};

const ChatInsideSidebar = ({ selectedChat }: Props) => {
  const members = selectedChat?.members ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          Members ({members.length})
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-3 pb-5">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-primary/5"
            >
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  height={36}
                  width={36}
                  alt={member.name}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="truncate text-sm">{member.name}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatInsideSidebar;