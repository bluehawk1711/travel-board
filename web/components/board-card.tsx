import Image from "next/image";
import Link from "next/link";
import type { FeedItem } from "@/lib/types";

/** Varied cover heights give the masonry grid its Pinterest-style rhythm. */
const COVER_ASPECTS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[2/3]",
  "aspect-[4/3]",
  "aspect-[3/4]",
];

function ownerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function CoverPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-end bg-sunset-gradient p-3">
      <span className="truncate text-lg font-bold text-white drop-shadow">
        {label}
      </span>
    </div>
  );
}

export function BoardCard({ board, index }: { board: FeedItem; index: number }) {
  const aspect = COVER_ASPECTS[index % COVER_ASPECTS.length];
  const cover = board.coverImageUrl ? (
    <Image
      src={board.coverImageUrl}
      alt={board.title}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
    />
  ) : (
    <CoverPlaceholder label={board.destination ?? board.title} />
  );

  return (
    <Link
      href={`/boards/${board.id}`}
      className="group mb-4 block break-inside-avoid"
    >
      <article className="overflow-hidden rounded-[20px] border border-border bg-card shadow-card transition-shadow duration-300 hover:shadow-nav">
        <div className={`relative w-full overflow-hidden bg-muted ${aspect}`}>
          {cover}

          {/* Bottom scrim keeps the overlay label legible over any photo. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-foreground/85 via-foreground/35 to-transparent" />

          {board.boardType === "ITINERARY" && (
            <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              Itinerary
            </span>
          )}

          <div className="absolute inset-x-3 bottom-3 text-white">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug drop-shadow-sm">
              {board.title}
            </h3>
            {board.destination && (
              <p className="mt-0.5 truncate text-[12px] font-semibold text-white/85">
                ◎ {board.destination}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
              {board.owner.avatarUrl ? (
                <Image
                  src={board.owner.avatarUrl}
                  alt={board.owner.name}
                  width={24}
                  height={24}
                  className="h-full w-full object-cover"
                />
              ) : (
                ownerInitials(board.owner.name)
              )}
            </span>
            <span className="truncate text-[12px] font-semibold text-foreground">
              {board.owner.name}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-1 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1 font-bold text-primary">
              ★ {board.saveCount} saves
            </span>
            <span className="flex items-center gap-2">
              <span>
                {board.itemCount} {board.itemCount === 1 ? "item" : "items"}
              </span>
              <span className="text-primary">♥ {board.likeCount}</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}