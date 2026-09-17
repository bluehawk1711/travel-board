export default function ChatLoading() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-1">
      <div className="w-full border-r border-zinc-200 dark:border-zinc-800">
        <div className="p-4">
          <div className="mb-4 h-7 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="size-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
