import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { periodStartDate, todayDateString, type Period } from "@/lib/dates";
import { formatCount, formatCurrency, formatKg, formatPercent } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "wtd", label: "WTD" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
];

export async function ManagementTier2({ period }: { period: Period }) {
  const supabase = await createClient();
  const start = periodStartDate(period);
  const today = todayDateString();

  const [{ data: sales }, { data: dsps }, { data: municipalities }, { data: customers }, { data: dspProfiles }, { data: tasks }] =
    await Promise.all([
      supabase
        .from("sales")
        .select("dsp_id, municipality_id, customer_id, customer_type, total_amount, total_canisters, total_volume_kg, is_repeat_purchase")
        .gte("sale_date", start)
        .lte("sale_date", today),
      supabase.from("dsps").select("id, name").eq("active", true).order("name"),
      supabase.from("municipalities").select("id, name, dsp_id").eq("active", true).order("name"),
      supabase.from("customers").select("id, first_purchase_date, dsp_id, customer_type"),
      supabase.from("profiles").select("id, dsp_id").not("dsp_id", "is", null),
      supabase.from("tasks").select("assigned_to, status, due_date, completed_at"),
    ]);

  const dspIdByProfileId = new Map((dspProfiles ?? []).map((p) => [p.id, p.dsp_id as string]));

  const rows = sales ?? [];
  const totalAmount = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalCanisters = rows.reduce((s, r) => s + r.total_canisters, 0);
  const totalVolumeKg = rows.reduce((s, r) => s + r.total_volume_kg, 0);

  interface DspAgg {
    id: string;
    name: string;
    volumeKg: number;
    revenue: number;
    accounts: Set<string>;
    newAccounts: number;
    transactions: number;
    repeat: number;
    tasksCompleted: number;
    tasksOverdue: number;
  }

  const dspAggById = new Map<string, DspAgg>();
  for (const dsp of dsps ?? []) {
    dspAggById.set(dsp.id, {
      id: dsp.id,
      name: dsp.name,
      volumeKg: 0,
      revenue: 0,
      accounts: new Set(),
      newAccounts: 0,
      transactions: 0,
      repeat: 0,
      tasksCompleted: 0,
      tasksOverdue: 0,
    });
  }

  const municipalityAgg = new Map<string, { name: string; volumeKg: number; revenue: number }>();
  for (const m of municipalities ?? []) {
    municipalityAgg.set(m.id, { name: m.name, volumeKg: 0, revenue: 0 });
  }

  for (const s of rows) {
    const dspAgg = dspAggById.get(s.dsp_id);
    if (dspAgg) {
      dspAgg.volumeKg += s.total_volume_kg;
      dspAgg.revenue += s.total_amount;
      dspAgg.transactions += 1;
      if (s.customer_type !== "HH") dspAgg.accounts.add(s.customer_id);
      if (s.is_repeat_purchase) dspAgg.repeat += 1;
    }
    const munAgg = municipalityAgg.get(s.municipality_id);
    if (munAgg) {
      munAgg.volumeKg += s.total_volume_kg;
      munAgg.revenue += s.total_amount;
    }
  }

  for (const c of customers ?? []) {
    if (
      c.customer_type !== "HH" &&
      c.first_purchase_date &&
      c.first_purchase_date >= start &&
      c.first_purchase_date <= today &&
      c.dsp_id
    ) {
      const agg = dspAggById.get(c.dsp_id);
      if (agg) agg.newAccounts += 1;
    }
  }

  // Task completion is attributed to the assignee's own DSP, not the task's
  // dsp_id (which reflects the creator's scope and can differ — §4.1 #4).
  for (const t of tasks ?? []) {
    const dspId = dspIdByProfileId.get(t.assigned_to);
    if (!dspId) continue;
    const agg = dspAggById.get(dspId);
    if (!agg) continue;
    if (t.status === "completed" && t.completed_at && t.completed_at >= start) {
      agg.tasksCompleted += 1;
    }
    if ((t.status === "pending" || t.status === "in_progress") && t.due_date && t.due_date < today) {
      agg.tasksOverdue += 1;
    }
  }

  const leaderboard = [...dspAggById.values()].sort((a, b) => b.volumeKg - a.volumeKg);
  const municipalityRanking = [...municipalityAgg.values()].sort((a, b) => b.volumeKg - a.volumeKg);
  const bottomThreeNames = new Set(
    municipalityRanking.slice(-3).map((m) => m.name)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">This period</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/?period=${p.value}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                p.value === period ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Volume</div>
            <div className="text-2xl font-semibold tabular-nums">{formatKg(totalVolumeKg)}</div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Canisters</div>
            <div className="text-2xl font-semibold tabular-nums">{formatCount(totalCanisters)}</div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Transactions</div>
            <div className="text-2xl font-semibold tabular-nums">{formatCount(rows.length)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">DSP leaderboard</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DSP</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Accounts</TableHead>
              <TableHead className="text-right">New accounts</TableHead>
              <TableHead className="text-right">Repeat rate</TableHead>
              <TableHead className="text-right">Tasks done</TableHead>
              <TableHead className="text-right">Tasks overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((dsp) => (
              <TableRow key={dsp.id}>
                <TableCell className="font-medium">{dsp.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(dsp.volumeKg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(dsp.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{dsp.accounts.size}</TableCell>
                <TableCell className="text-right tabular-nums">{dsp.newAccounts}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(dsp.transactions > 0 ? dsp.repeat / dsp.transactions : 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{dsp.tasksCompleted}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {dsp.tasksOverdue > 0 ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {dsp.tasksOverdue}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Municipality performance</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Municipality</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {municipalityRanking.map((m) => (
              <TableRow key={m.name} className={cn(bottomThreeNames.has(m.name) && "bg-destructive/5")}>
                <TableCell className="flex items-center gap-1.5 font-medium">
                  {m.name}
                  {bottomThreeNames.has(m.name) ? (
                    <Badge variant="destructive" className="text-[10px]">
                      lowest
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(m.volumeKg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(m.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
