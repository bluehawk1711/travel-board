import AccordionMotionServices from "@/components/shadcn-space/accordion/accordion-07";
import { UI_MESSAGES } from "@travel-board/shared";

export function HowItWorks() {
  return (
    <section className="mx-auto mt-16 w-full max-w-3xl" aria-labelledby="how-it-works">
      <div className="text-center">
        <h2
          id="how-it-works"
          className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          {UI_MESSAGES.HOW_IT_WORKS.HEADING}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          From discovery to a shared itinerary in four steps.
        </p>
      </div>
      <AccordionMotionServices />
    </section>
  );
}