import { sub } from "date-fns";
import {
  Chat,
  CURRENT_USER_ID,
} from "@/components/shadcn-space/radix/blocks/chat-application-01/types";

export const chatData: Chat[] = [
  {
    id: "1",
    name: "James Johnson",
    status: "online",
    thumb:
      "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-5.webp",
    excerpt: "Theme Developer",
    messages: [
      {
        id: 1,
        senderId: CURRENT_USER_ID,
        senderName: "Cameron",
        senderAvatarUrl:
          "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-2.webp",
        body: "Hey James, can you share the latest files for the service task?",
        createdAt: sub(new Date(), { hours: 1 }).toISOString(),
      },
      {
        id: 2,
        senderId: "1",
        senderName: "James Johnson",
        senderAvatarUrl:
          "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-5.webp",
        body: "Sure, sending it over in a minute.",
        createdAt: sub(new Date(), { minutes: 6 }).toISOString(),
      },
      {
        id: 3,
        senderId: CURRENT_USER_ID,
        senderName: "Cameron",
        senderAvatarUrl:
          "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-2.webp",
        body: "Looks great, thanks!",
        createdAt: sub(new Date(), { minutes: 5 }).toISOString(),
      },
    ],
    members: [
      { userId: "1", name: "James Johnson", avatarUrl: "" },
      { userId: "me", name: "Cameron", avatarUrl: "" },
    ],
  },
  {
    id: "2",
    name: "Maria Hernandez",
    status: "away",
    thumb:
      "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-9.webp",
    excerpt: "Doctor",
    messages: [
      {
        id: 1,
        senderId: "2",
        senderName: "Maria Hernandez",
        senderAvatarUrl:
          "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-9.webp",
        body: "Hi, I've attached the reports you asked for.",
        createdAt: sub(new Date(), { hours: 1 }).toISOString(),
      },
      {
        id: 2,
        senderId: CURRENT_USER_ID,
        senderName: "Cameron",
        senderAvatarUrl:
          "https://images.shadcnspace.com/assets/shadcn-dashboard/profile/user-2.webp",
        body: "Got it, thank you Maria.",
        createdAt: sub(new Date(), { minutes: 6 }).toISOString(),
      },
    ],
    members: [
      { userId: "2", name: "Maria Hernandez", avatarUrl: "" },
      { userId: "me", name: "Cameron", avatarUrl: "" },
    ],
  },
];