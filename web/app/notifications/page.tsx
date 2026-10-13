import type { Metadata } from "next";

import { NotificationsList } from "@/components/notifications-list";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Follows, likes, saves, comments and messages on your boards.",
};

export default function NotificationsPage() {
  return <NotificationsList />;
}
