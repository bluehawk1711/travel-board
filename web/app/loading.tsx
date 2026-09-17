const SKELETON_ASPECTS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-square"];

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-6 h-9 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="mb-4 break-inside-avoid rounded-2xl bg-zinc-100 dark:bg-zinc-900"
          >
            <div
              className={`w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800 ${
                SKELETON_ASPECTS[i % SKELETON_ASPECTS.length]
              }`}
            />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}