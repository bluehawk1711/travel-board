import PlaceCard from "@/components/shadcn-space/card/card-23";
import type { FeedItem } from "@/lib/types";

export function FeaturedDestination({ board }: { board: FeedItem }) {
  return (
    <PlaceCard
      title={board.title}
      description={
        board.destination ?? `${board.itemCount} items · ${board.owner.name}`
      }
      image={board.coverImageUrl ?? undefined}
      href={`/boards/${board.id}`}
    />
  );
}