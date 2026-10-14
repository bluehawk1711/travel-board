"use client";

import { UI_MESSAGES } from "@travel-board/shared";

/**
 * Root route error boundary. The title/hint live in UI_MESSAGES so the copy
 * stays route-agnostic (it previously claimed "explore feed" on every page).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {UI_MESSAGES.COMMON.PAGE_ERROR_TITLE}
      </h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {error.message} {UI_MESSAGES.COMMON.PAGE_ERROR_HINT}
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
      >
        {UI_MESSAGES.COMMON.RETRY}
      </button>
    </main>
  );
}
