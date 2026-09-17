"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export interface FloatingPillProps {
  current: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export default function FloatingPill({
  current,
  totalPages,
  onPageChange,
  className,
}: FloatingPillProps) {
  const pages = Math.max(1, totalPages);

  return (
    <Pagination className={className}>
      <PaginationContent className="bg-background/80 border p-1 rounded-full transition-all">
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange?.(Math.max(1, current - 1));
            }}
            aria-disabled={current <= 1}
            className={cn(
              "rounded-full hover:bg-muted",
              current <= 1 && "pointer-events-none opacity-40",
            )}
          />
        </PaginationItem>

        <div className="relative flex items-center mx-1">
          {Array.from({ length: pages }).map((_, i) => {
            const page = i + 1;
            const isActive = current === page;
            return (
              <PaginationItem key={page} className="relative">
                <PaginationLink
                  href="#"
                  isActive={isActive}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange?.(page);
                  }}
                  className={cn(
                    "relative z-10 w-9 h-9 rounded-full border-0 transition-colors uppercase text-xs font-bold tracking-tighter",
                    isActive
                      ? "bg-transparent text-primary-foreground hover:bg-transparent hover:text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {page}
                </PaginationLink>
                {isActive && (
                  <motion.div
                    layoutId="pill-active"
                    className="absolute inset-0 bg-primary rounded-full shadow-md"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </PaginationItem>
            );
          })}
        </div>

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange?.(Math.min(pages, current + 1));
            }}
            aria-disabled={current >= pages}
            className={cn(
              "rounded-full hover:bg-muted transition-transform active:scale-95",
              current >= pages && "pointer-events-none opacity-40",
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}