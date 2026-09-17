import { SetupSteps } from "@/components/shadcn-space/animated-list/animated-list-02";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TRIP_STEPS = [
  { id: "destination", title: "Pick a destination" },
  { id: "dates", title: "Choose your dates" },
  { id: "stays", title: "Reserve stays & transport" },
  { id: "activities", title: "Plan daily activities" },
  { id: "pack", title: "Pack & go" },
];

export function TripChecklist() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Trip checklist</CardTitle>
        <CardDescription>
          The classic planning flow — follow it on your own boards.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <SetupSteps steps={TRIP_STEPS} />
      </CardContent>
    </Card>
  );
}