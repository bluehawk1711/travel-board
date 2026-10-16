import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safe 2-letter avatar initials. Never throws: falls back from name →
 * secondary text (e.g. email) → "?", so a missing/partial profile name can
 * never crash a render the way `name.slice(0, 2)` did.
 */
export function initials(name?: string | null, alt?: string | null): string {
  const source = name?.trim() || alt?.trim() || "";
  return source ? source.slice(0, 2).toUpperCase() : "?";
}