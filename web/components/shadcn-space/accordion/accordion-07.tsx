"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface AccordionFaqItem {
  id: string;
  number: string;
  title: string;
  content: string;
}

export const defaultFaqItems: AccordionFaqItem[] = [
  {
    id: "discover",
    number: "01",
    title: "Discover boards",
    content:
      "Browse public travel boards from the community — itineraries, destination collections, and saved inspiration — filtered by destination or trip dates.",
  },
  {
    id: "plan",
    number: "02",
    title: "Plan together, live",
    content:
      "Sections and items update in real time for everyone viewing the board. Invite collaborators, chat about the trip in the board room, and watch edits land instantly.",
  },
  {
    id: "save",
    number: "03",
    title: "Save & build your trip",
    content:
      "Like and save boards to your collection, then use them as the starting point for your own itinerary — swap dates, reorder days, and make it yours.",
  },
  {
    id: "share",
    number: "04",
    title: "Share the plan",
    content:
      "Boards are shareable links. Private boards stay visible only to members, while public boards feed the explore page for everyone to discover.",
  },
];

export interface AccordionFaqProps {
  items?: AccordionFaqItem[];
  defaultOpenId?: string;
}

const AccordionMotionServices = ({
  items = defaultFaqItems,
  defaultOpenId = defaultFaqItems[0]?.id,
}: AccordionFaqProps) => {
  const [openItems, setOpenItems] = useState<string[]>(
    defaultOpenId ? [defaultOpenId] : [],
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="w-full"
        >
          {items.map((item) => {
            const isActive = openItems.includes(item.id);
            const isHovered = hoveredId === item.id;

            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="relative border-none not-last:border-none"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <AccordionTrigger className="hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden px-1 py-5 cursor-pointer">
                  <div className="flex items-center gap-6 w-full">
                    {/* Number bubble */}
                    <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                      <motion.div
                        className="absolute inset-0 rounded-full bg-foreground"
                        initial={false}
                        animate={{
                          scale: isActive ? 1 : isHovered ? 0.85 : 0,
                          opacity: isActive ? 1 : isHovered ? 0.1 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      />
                      <motion.span
                        className="relative z-10 text-sm font-medium tracking-wide"
                        animate={{
                          color: isActive
                            ? "var(--color-primary-foreground)"
                            : "var(--color-muted-foreground)",
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.number}
                      </motion.span>
                    </div>

                    {/* Title */}
                    <motion.span
                      className="text-base font-medium"
                      animate={{
                        x: isActive || isHovered ? 4 : 0,
                        color:
                          isActive || isHovered
                            ? "var(--color-foreground)"
                            : "var(--color-muted-foreground)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      {item.title}
                    </motion.span>

                    {/* Plus / X icon */}
                    <motion.div
                      className="ml-auto flex h-8 w-8 items-center justify-center shrink-0"
                      animate={{
                        rotate: isActive ? 45 : 0,
                        opacity: isActive || isHovered ? 1 : 0.4,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Plus className="size-4 text-foreground" />
                    </motion.div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pl-16 pr-4 pb-6 text-sm text-muted-foreground leading-relaxed">
                  {item.content}
                </AccordionContent>

                {/* Static border */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />

                {/* Animated active/hover line */}
                <motion.div
                  className="absolute bottom-0 left-0 h-px origin-left bg-foreground"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isActive ? 1 : isHovered ? 0.3 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};

export default AccordionMotionServices;
