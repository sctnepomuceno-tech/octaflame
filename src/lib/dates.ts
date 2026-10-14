import { toZonedTime } from "date-fns-tz";
import { startOfWeek, startOfMonth, startOfYear, endOfMonth, subDays, format } from "date-fns";

export const BUSINESS_TIMEZONE = "Asia/Manila";

export type Period = "today" | "wtd" | "mtd" | "ytd";

export function todayInManila(): Date {
  return toZonedTime(new Date(), BUSINESS_TIMEZONE);
}

/** Inclusive start date (YYYY-MM-DD) for a dashboard period toggle (§8.1). */
export function periodStartDate(period: Period): string {
  const now = todayInManila();
  switch (period) {
    case "today":
      return format(now, "yyyy-MM-dd");
    case "wtd":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "mtd":
      return format(startOfMonth(now), "yyyy-MM-dd");
    case "ytd":
      return format(startOfYear(now), "yyyy-MM-dd");
  }
}

/** Inclusive start/end dates (YYYY-MM-DD) for a "YYYY-MM" month key. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(year, m - 1, 1);
  return {
    start: format(first, "yyyy-MM-dd"),
    end: format(endOfMonth(first), "yyyy-MM-dd"),
  };
}

export function todayDateString(): string {
  return format(todayInManila(), "yyyy-MM-dd");
}

export function daysAgoDateString(days: number): string {
  return format(subDays(todayInManila(), days), "yyyy-MM-dd");
}
