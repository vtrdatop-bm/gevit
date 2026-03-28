import { differenceInDays } from "date-fns";

/**
 * Computes the number of days between two date strings (YYYY-MM-DD).
 */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  const diff = differenceInDays(db, da);
  return diff >= 0 ? diff : null;
}

/**
 * Computes the average of an array of numbers.
 */
export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
