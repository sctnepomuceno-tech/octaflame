"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

import { formatCount, formatCurrency, formatKg, formatMt, formatPercent } from "@/lib/volume/format";

// A function prop can't cross the server/client boundary (it isn't
// serializable), so callers pass a formatter key instead of a function —
// this file is the one place that owns the actual @/lib/volume/format import.
const FORMATTERS = {
  count: formatCount,
  mt: formatMt,
  kg: formatKg,
  currency: formatCurrency,
  percent: (n: number) => formatPercent(n),
} as const;

/**
 * Number count-up on dashboard load (§16). Short and one-shot — never
 * re-animates on re-render with the same value, and finishes well under a
 * second so it never delays the data actually being readable.
 */
export function AnimatedNumber({
  value,
  format,
  durationSec = 0.6,
}: {
  value: number;
  format: keyof typeof FORMATTERS;
  durationSec?: number;
}) {
  const [display, setDisplay] = useState(0);
  const lastValue = useRef<number | null>(null);

  useEffect(() => {
    if (lastValue.current === value) return;
    const from = lastValue.current ?? 0;
    lastValue.current = value;
    const controls = animate(from, value, {
      duration: durationSec,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, durationSec]);

  return <>{FORMATTERS[format](display)}</>;
}
