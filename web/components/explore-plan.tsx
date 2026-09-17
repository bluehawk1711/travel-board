"use client";

import { useMemo } from "react";
import { addDays, startOfMonth, endOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { MapPin } from "lucide-react";
import IconAutocomplete from "@/components/shadcn-space/autocomplete/autocomplete-06";
import RangeCalendar from "@/components/shadcn-space/calendar/calendar-14";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeedItem } from "@/lib/types";

export interface ExploreFilter {
  destination: string | null;
  dateRange: DateRange | null;
}

export const EMPTY_FILTER: ExploreFilter = {
  destination: null,
  dateRange: null,
};

function tripPresets(): { label: string; presets: { label: string; range: DateRange }[] }[] {
  const today = new Date();
  const weekendOffset = (5 - today.getDay() + 7) % 7;
  return [
    {
      label: "Days",
      presets: [
        { label: "Today", range: { from: today, to: today } },
        { label: "Tomorrow", range: { from: addDays(today, 1), to: addDays(today, 1) } },
      ],
    },
    {
      label: "Weeks",
      presets: [
        {
          label: "This weekend",
          range: {
            from: addDays(today, weekendOffset),
            to: addDays(today, weekendOffset + 1),
          },
        },
        {
          label: "Next 7 days",
          range: { from: today, to: addDays(today, 6) },
        },
      ],
    },
    {
      label: "Months",
      presets: [
        {
          label: "This month",
          range: { from: startOfMonth(today), to: endOfMonth(today) },
        },
        {
          label: "Next month",
          range: {
            from: startOfMonth(addDays(today, 31)),
            to: endOfMonth(addDays(today, 31)),
          },
        },
      ],
    },
  ];
}

export function ExplorePlanner({
  items,
  value,
  onChange,
}: {
  items: FeedItem[];
  value: ExploreFilter;
  onChange: (filter: ExploreFilter) => void;
}) {
  const destinations = useMemo(
    () => [
      ...new Set(
        items
          .map((item) => item.destination)
          .filter((d): d is string => Boolean(d)),
      ),
    ],
    [items],
  );
  const options = useMemo(
    () => destinations.map((d) => ({ id: d, label: d, icon: <MapPin /> })),
    [destinations],
  );

  const hasFilter = Boolean(value.destination || value.dateRange?.from);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Plan a trip</CardTitle>
        <CardDescription>
          Search boards by destination and trip dates. Filters apply to the
          loaded feed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <IconAutocomplete
          label="Where to?"
          placeholder="Search destinations…"
          options={options}
          onSelect={(id) => onChange({ ...value, destination: id })}
        />

        <RangeCalendar
          value={value.dateRange ?? undefined}
          onValueChange={(range) => onChange({ ...value, dateRange: range ?? null })}
          presets={tripPresets()}
        />

        {hasFilter && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit cursor-pointer"
            onClick={() => onChange(EMPTY_FILTER)}
          >
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}