import { FollowingFeed } from "@/components/following-feed";

// Static shell (Cache Components): the feed is a client component that fetches
// through React Query, so nothing here defers to request time.

export default function FollowingPage() {
  return <FollowingFeed />;
}
