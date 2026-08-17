"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

/**
 * A generic monthly trend line, used for both the volume trend and the
 * customer acquisition curve (§12). Desktop/tablet gets a real chart;
 * below 768px a 12-point line chart is unreadable, so it's replaced with
 * a ranked list with inline bar fills — a better rendering, not a
 * degraded fallback (§16.2).
 */
export function TrendChart({
  data,
  color = "var(--primary)",
  formatValue,
}: {
  data: TrendPoint[];
  color?: string;
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <>
      <div className="hidden h-56 md:block">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={56} />
            <Tooltip
              formatter={(value) => formatValue(Number(value))}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-1.5 md:hidden">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{d.label}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {formatValue(d.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
