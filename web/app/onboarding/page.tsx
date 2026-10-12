"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CalendarDays, Layers, MapPin } from "lucide-react";
import type { DateRange } from "react-day-picker";
import Stepper03, { type Step } from "@/components/shadcn-space/stepper/stepper-03";
import IconAutocomplete from "@/components/shadcn-space/autocomplete/autocomplete-06";
import RangeCalendar from "@/components/shadcn-space/calendar/calendar-14";
import { ValidationInputField } from "@/components/shadcn-space/input/input-19";
import { Button } from "@/components/ui/button";
import { createBoard, type CreateBoardPayload } from "@/lib/board-edit";
import { API_URL } from "@/lib/api";
import { useDestinationOptions } from "@/lib/queries";

const STEPS: Step[] = [
  {
    title: "Destination",
    icon: MapPin,
    content: "Where are you heading?",
  },
  {
    title: "Dates",
    icon: CalendarDays,
    content: "When are you traveling?",
  },
  {
    title: "Board type",
    icon: Layers,
    content: "How will you plan it?",
  },
  {
    title: "Done",
    icon: CheckCircle2,
    content: "Ready to create your board",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [boardType, setBoardType] = useState<"ITINERARY" | "FREEFORM">(
    "ITINERARY",
  );
  const [error, setError] = useState<string | null>(null);

  // Suggest real destinations from the explore feed so the autocomplete has
  // options without a dedicated endpoint (React Query-cached, 5 min stale).
  const { data: feedDestinationValues } = useDestinationOptions();
  const feedDestinations = useMemo(
    () =>
      (feedDestinationValues ?? []).map((value) => ({
        id: value,
        label: value,
      })),
    [feedDestinationValues],
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

  // Suggest real destinations from the explore feed so the autocomplete has
  // options without a dedicated endpoint.
  const destinationOptions =
    feedDestinations.length > 0
      ? feedDestinations
      : destination
        ? [{ id: destination, label: destination }]
        : [];

  const destinationProgress =
    destination.trim().length >= 3 ? 1 : destination.trim().length / 3;

  // Computed once at mount so no impure calls run during re-renders.
  const [weekendPresets] = useState(() => {
    const today = new Date();
    return [
      {
        label: "Weeks",
        presets: [
          {
            label: "This weekend",
            range: {
              from: today,
              to: new Date(today.getTime() + 2 * 86_400_000),
            },
          },
          {
            label: "Next 7 days",
            range: {
              from: today,
              to: new Date(today.getTime() + 6 * 86_400_000),
            },
          },
        ],
      },
    ];
  });

  const handleFinish = () => {
    if (!destination.trim()) {
      setError("Pick a destination first.");
      return;
    }
    setError(null);
    createMutation.mutate({
      title: `${destination.trim()} trip`,
      destination: destination.trim(),
      boardType,
      visibility: "PUBLIC",
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    });
  };

  const creating = createMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Plan your trip
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          A few quick questions, then we&apos;ll spin up your board.
        </p>
      </div>

      <Stepper03
        steps={STEPS}
        onFinish={() => void handleFinish()}
        renderStep={(index) => {
          if (index === 0) {
            return (
              <div className="mx-auto flex max-w-sm flex-col gap-4 text-left">
                <IconAutocomplete
                  label="Where to?"
                  placeholder="e.g. Kyoto, Lisbon, Patagonia…"
                  options={destinationOptions}
                  onSelect={(value) => setDestination(value ?? "")}
                />
                <ValidationInputField
                  id="onboarding-destination"
                  label="Or type it"
                  type="text"
                  placeholder="Destination"
                  value={destination}
                  onChange={setDestination}
                  progress={destinationProgress}
                  helperText="3+ characters"
                />
              </div>
            );
          }
          if (index === 1) {
            return (
              <div className="flex flex-col items-center gap-3">
                <RangeCalendar
                  value={dateRange ?? undefined}
                  onValueChange={(range) => setDateRange(range ?? null)}
                  presets={weekendPresets}
                />
                {dateRange?.from && (
                  <p className="text-sm text-muted-foreground">
                    {dateRange.from.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {dateRange.to &&
                      ` – ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                )}
              </div>
            );
          }
          if (index === 2) {
            return (
              <div className="mx-auto flex max-w-md flex-col gap-3">
                {(
                  [
                    {
                      id: "ITINERARY" as const,
                      title: "Itinerary",
                      desc: "Day-by-day sections with activities and bookings.",
                    },
                    {
                      id: "FREEFORM" as const,
                      title: "Freeform",
                      desc: "A free-floating collection of places and inspiration.",
                    },
                  ]
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBoardType(option.id)}
                    className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                      boardType === option.id
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <p className="text-sm font-semibold">{option.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.desc}
                    </p>
                  </button>
                ))}
              </div>
            );
          }
          return (
            <div className="mx-auto flex max-w-md flex-col gap-2 text-center">
              <p className="text-sm text-muted-foreground">Your trip:</p>
              <p className="text-lg font-semibold">
                {destination.trim() || "…"}
                {dateRange?.from &&
                  ` · ${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${dateRange.to ? ` – ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {boardType === "ITINERARY" ? "Itinerary" : "Freeform"} board ·
                public
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {creating && (
                <p className="text-sm text-muted-foreground">Creating…</p>
              )}
            </div>
          );
        }}
      />

      <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Need an account?{" "}
        <a href={`${API_URL}/auth/google`} className="underline">
          Sign in with Google
        </a>{" "}
        first.
      </p>

      <div className="mt-4 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer text-muted-foreground"
          onClick={() => router.push("/")}
        >
          Skip — just explore
        </Button>
      </div>
    </main>
  );
}