/**
 * Display rules (§7.1): MT to 3 decimals, kg to 1 decimal, canisters and
 * crates as integers, currency as ₱ with thousand separators and 2
 * decimals. Use tabular figures everywhere (see globals.css `.tabular-nums`
 * and the `tabular-nums` class applied to <body>).
 */

const PH_LOCALE = "en-PH";

export function formatMt(mt: number): string {
  return `${new Intl.NumberFormat(PH_LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(mt)} MT`;
}

export function formatKg(kg: number): string {
  return `${new Intl.NumberFormat(PH_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kg)} kg`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(PH_LOCALE, {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(PH_LOCALE, {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(fraction: number, decimals = 0): string {
  return new Intl.NumberFormat(PH_LOCALE, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fraction);
}
