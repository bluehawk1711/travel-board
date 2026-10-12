"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import IconAutocomplete from "@/components/shadcn-space/autocomplete/autocomplete-06";
import RangeCalendar from "@/components/shadcn-space/calendar/calendar-14";
import { AutoGrowTextarea } from "@/components/shadcn-space/textarea/textarea-05";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBoard, type CreateBoardPayload } from "@/lib/board-edit";
import { useDestinationOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function NewBoardPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [destination, setDestination] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [boardType, setBoardType] = useState<"ITINERARY" | "FREEFORM">(
    "ITINERARY",
  );
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState<string | null>(null);

  // Destination suggestions come from the newest public boards (React Query).
  const { data: destinations } = useDestinationOptions();
  const destinationOptions = useMemo(
    () => (destinations ?? []).map((value) => ({ id: value, label: value })),
    [destinations],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateBoardPayload) => createBoard(payload),
    onSuccess: (board) => {
      router.push(`/boards/${board.id}`);
    },
    onError: (err: Error) => {
      setError(err.message || "Couldn't create the board — check that you're signed in.");
    },
  });

  const submit = () => {
    if (!title.trim()) {
      setError("Give your board a title.");
      return;
    }
    setError(null);
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      destination: destination.trim() || undefined,
      boardType,
      visibility,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    });
  };

  const submitting = createMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          New board
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Start a travel board — you can edit it live with collaborators.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <Label htmlFor="board-title">Title</Label>
          <Input
            id="board-title"
            placeholder="e.g. Kyoto in autumn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <AutoGrowTextarea
          label="Description"
          placeholder="What's this trip about?"
          value={description}
          onChange={setDescription}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Destination</Label>
            <IconAutocomplete
              placeholder="Search destinations…"
              options={destinationOptions}
              onSelect={(value) => setDestination(value ?? "")}
            />
            {!destination && (
              <Input
                placeholder="…or type it"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                maxLength={200}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Trip dates</Label>
            <RangeCalendar
              value={dateRange ?? undefined}
              onValueChange={(range) => setDateRange(range ?? null)}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Board type</Label>
            <div className="flex gap-2">
              {(
                [
                  { id: "ITINERARY" as const, label: "Itinerary" },
                  { id: "FREEFORM" as const, label: "Freeform" },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBoardType(option.id)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    boardType === option.id
                      ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="flex gap-2">
              {(
                [
                  { id: "PUBLIC" as const, label: "Public" },
                  { id: "PRIVATE" as const, label: "Private" },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setVisibility(option.id)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    visibility === option.id
                      ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Creating…" : "Create board"}
          </Button>
        </div>
      </div>
    </main>
  );
}