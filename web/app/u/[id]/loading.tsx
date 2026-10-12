export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="size-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="columns-2 gap-4 md:columns-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mb-4 break-inside-avoid">
            <div
              className="w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
              style={{ aspectRatio: i % 2 === 0 ? "3 / 4" : "4 / 3" }}
            />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
