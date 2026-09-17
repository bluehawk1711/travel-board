"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Phone, Video } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Chat,
  ChatMessage,
} from "@/components/shadcn-space/radix/blocks/chat-application-01/types";
import ChatInsideSidebar from "@/components/shadcn-space/radix/blocks/chat-application-01/chatinside-sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Props = {
  selectedChat: Chat | null;
  /** Current user's id so messages can be aligned mine/theirs. */
  currentUserId?: string | null;
  onClickMobile: (event: React.MouseEvent<HTMLElement>) => void;
};

const ChatContent = ({ selectedChat, currentUserId, onClickMobile }: Props) => {
  const [isRightSide, setIsRightSide] = useState(true);
  const [isOpenMedia, setIsOpenMedia] = useState(false);

  const handleButtonClick = () => setIsRightSide(!isRightSide);
  const handleClose = () => setIsOpenMedia(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [selectedChat?.id, selectedChat?.messages?.length]);

  if (!selectedChat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No conversation selected
      </div>
    );
  }

  const isMine = (msg: ChatMessage) =>
    currentUserId != null && msg.senderId === currentUserId;

  return (
    <>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="h-8 w-8 flex justify-center items-center lg:hidden cursor-pointer"
              onClick={onClickMobile}
            >
              <Menu size={18} />
            </Button>
            <div className="relative sm:min-w-12 min-w-9">
              {selectedChat.thumb ? (
                <img
                  src={selectedChat.thumb}
                  height={48}
                  width={48}
                  alt="user"
                  className="rounded-full sm:h-12 sm:w-12 h-9 w-9"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground sm:h-12 sm:w-12">
                  {selectedChat.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span
                className={cn(
                  "p-0 h-2 w-2 rounded-full absolute bottom-1 inset-e-0",
                  selectedChat.status === "online"
                    ? "bg-teal-400"
                    : selectedChat.status === "busy"
                      ? "bg-red-500"
                      : selectedChat.status === "away"
                        ? "bg-amber-300"
                        : "bg-orange-400",
                )}
              />
            </div>
            <div>
              <h5 className="text-base sm:mb-1">{selectedChat.name}</h5>
              <div className="text-sm text-muted-foreground line-clamp-1">
                {selectedChat.excerpt || `${selectedChat.members.length} members`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-9 w-9 flex justify-center items-center rounded-lg hover:bg-primary/5 hover:text-primary cursor-pointer bg-transparent sm:h-10 sm:w-10">
              <Phone size={18} className="sm:h-10" />
            </div>
            <div className="h-9 w-9 flex justify-center items-center rounded-lg hover:bg-primary/5 hover:text-primary cursor-pointer bg-transparent sm:h-10 sm:w-10">
              <Video size={20} className="sm:h-10" />
            </div>
            <div
              className="h-9 w-9 justify-center items-center rounded-lg hover:bg-primary/5 hover:text-primary cursor-pointer bg-transparent sm:h-10 sm:w-10 xl:flex hidden"
              onClick={handleButtonClick}
            >
              <Menu size={18} className="sm:h-10" />
            </div>
            <div
              className="h-9 w-9 justify-center items-center rounded-lg hover:bg-primary/5 hover:text-primary cursor-pointer bg-transparent sm:h-10 sm:w-10 xl:hidden flex"
              onClick={() => setIsOpenMedia(true)}
            >
              <Menu size={22} className="sm:h-10" />
            </div>
          </div>
        </div>
      </div>

      <Separator />
      <div className="flex h-full w-full">
        <div
          className={`transition-all ${
            !isRightSide ? "lg:w-full" : "xl:w-[calc(100%-300px)] w-full"
          }`}
        >
          <div
            className={`${
              !isRightSide ? "border-none" : "lg:border-e"
            } border-border h-full flex flex-col`}
          >
            {/* Chat messages scroll container */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-5 py-5">
                  {selectedChat.messages.map((msg: ChatMessage) => (
                    <div
                      className="flex gap-3 mb-7.5"
                      key={`${msg.id}-${msg.createdAt}`}
                    >
                      {isMine(msg) ? (
                        <div className="flex justify-end w-full">
                          <div>
                            <div
                              className="text-xs text-muted-foreground font-medium mb-1 block text-end"
                              suppressHydrationWarning
                            >
                              {formatDistanceToNowStrict(
                                new Date(msg.createdAt),
                                { addSuffix: false },
                              )}{" "}
                              ago
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-md wrap-break-word max-w-2xl ms-auto">
                              {msg.body}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <div className="w-10">
                            {msg.senderAvatarUrl ? (
                              <img
                                src={msg.senderAvatarUrl}
                                height={40}
                                width={40}
                                alt={msg.senderName}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {msg.senderName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div
                              className="text-xs text-muted-foreground font-normal mb-1 block"
                              suppressHydrationWarning
                            >
                              {msg.senderName},{" "}
                              {formatDistanceToNowStrict(
                                new Date(msg.createdAt),
                                { addSuffix: false },
                              )}{" "}
                              ago
                            </div>
                            <div className="p-2 bg-muted dark:bg-neutral-800 rounded-md wrap-break-word max-w-[70%]">
                              {msg.body}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
        <div
          className={`shrink-0 ${
            !isRightSide ? "max-w-0" : "xl:max-w-75 max-w-0 w-full"
          }`}
        >
          <ChatInsideSidebar selectedChat={selectedChat} />
        </div>
        <Sheet open={isOpenMedia} onOpenChange={handleClose}>
          <SheetContent side="right" className="">
            <ChatInsideSidebar selectedChat={selectedChat} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default ChatContent;