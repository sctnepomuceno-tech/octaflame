/** Pure calculation helpers for the Analytics page (§12). No data fetching here. */

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Null when there's no prior-period baseline to compare against. */
export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export function addMonthsToKey(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The current month plus the `count - 1` months before it, newest first, for a month-picker dropdown. */
export function recentMonthOptions(currentKey: string, count: number): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const key = addMonthsToKey(currentKey, -i);
    const [y, m] = key.split("-").map(Number);
    return { value: key, label: `${MONTH_NAMES[m - 1]} ${y}` };
  });
}
