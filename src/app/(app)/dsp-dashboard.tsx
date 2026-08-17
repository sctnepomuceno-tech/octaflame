import Link from "next/link";
import { format as formatDate, endOfWeek } from "date-fns";
import { CalendarClock, CheckCircle2, Clock, ListTodo, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDspStockSummary } from "@/app/actions/stock";
import {
  periodStartDate,
  todayDateString,
  daysAgoDateString,
  todayInManila,
  type Period,
} from "@/lib/dates";
import { kgToMt } from "@/lib/volume/calculations";
import { formatCount, formatCurrency, formatKg, formatMt, formatPercent } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StaggerGrid, StaggerItem } from "@/components/motion/stagger-grid";
import { TaskQuickComplete } from "./tasks/task-quick-complete";
import type { Database } from "@/lib/supabase/database.types";

type TaskWidgetRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "due_date" | "priority" | "status" | "customer_id"
>;

function TaskWidget({
  title,
  icon: Icon,
  tasks,
  quickComplete,
  customerLabelById,
}: {
  title: string;
  icon: typeof ListTodo;
  tasks: TaskWidgetRow[];
  quickComplete: boolean;
  customerLabelById: Map<string, string>;
}) {
  return (
    <Card className="p-4">
      <CardContent className="flex flex-col gap-2 p-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {title} · {tasks.length}
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                {quickComplete ? (
                  <TaskQuickComplete taskId={t.id} completed={false} />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-muted-foreground/50" />
                )}
                <span className="truncate">
                  {t.title}
                  {t.customer_id && customerLabelById.get(t.customer_id) ? (
                    <span className="text-muted-foreground"> · {customerLabelById.get(t.customer_id)}</span>
                  ) : null}
                </span>
              </div>
            ))}
            {tasks.length > 4 ? (
              <Link href="/tasks" className="text-xs text-muted-foreground hover:underline">
                +{tasks.length - 4} more
              </Link>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "wtd", label: "WTD" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
];

function StatCard({
  label,
  value,
  format,
  sub,
}: {
  label: string;
  value: number;
  format: "currency" | "kg" | "count";
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">
          <AnimatedNumber value={value} format={format} />
        </div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export async function DspDashboard({
  dspId,
  dspName,
  userId,
  period,
}: {
  dspId: string;
  dspName: string;
  userId: string;
  period: Period;
}) {
  const supabase = await createClient();
  const start = periodStartDate(period);
  const today = todayDateString();
  const heatmapStart = daysAgoDateString(29);
  const weekEnd = formatDate(endOfWeek(todayInManila(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const year = new Date().getFullYear();

  const [
    { data: periodSales },
    { data: heatmapSales },
    { data: recentSales },
    { data: kpiRows },
    { data: ownYearSales },
    stockSummary,
    { data: openTasks },
    { data: recentlyCompletedTasks },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_date, customer_id, customer_type, municipality_id, total_amount, total_canisters, total_crates, total_volume_kg, is_repeat_purchase")
      .eq("dsp_id", dspId)
      .gte("sale_date", start)
      .lte("sale_date", today),
    supabase
      .from("sales")
      .select("sale_date, total_volume_kg")
      .eq("dsp_id", dspId)
      .gte("sale_date", heatmapStart)
      .lte("sale_date", today),
    supabase
      .from("sales")
      .select("id, sale_date, receipt_no, customer_id, total_amount, total_volume_kg, payment_status")
      .eq("dsp_id", dspId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("company_kpi_progress", { p_year: year }),
    supabase
      .from("sales")
      .select("customer_id, customer_type, total_volume_kg")
      .eq("dsp_id", dspId)
      .gte("sale_date", `${year}-01-01`)
      .lte("sale_date", today),
    getDspStockSummary(dspId),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, customer_id")
      .eq("assigned_to", userId)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, customer_id")
      .eq("assigned_to", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);

  const sales = periodSales ?? [];
  const totalAmount = sales.reduce((s, r) => s + r.total_amount, 0);
  const totalCanisters = sales.reduce((s, r) => s + r.total_canisters, 0);
  const totalCrates = sales.reduce((s, r) => s + r.total_crates, 0);
  const totalVolumeKg = sales.reduce((s, r) => s + r.total_volume_kg, 0);
  const uniqueAccounts = new Set(
    sales.filter((s) => s.customer_type !== "HH").map((s) => s.customer_id)
  ).size;
  const repeatPurchases = sales.filter((s) => s.is_repeat_purchase).length;

  const municipalityTotals = new Map<string, number>();
  const customerTotals = new Map<string, number>();
  for (const s of sales) {
    municipalityTotals.set(s.municipality_id, (municipalityTotals.get(s.municipality_id) ?? 0) + s.total_volume_kg);
    customerTotals.set(s.customer_id, (customerTotals.get(s.customer_id) ?? 0) + s.total_volume_kg);
  }
  const topMunicipalityId = [...municipalityTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCustomerId = [...customerTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const [{ data: municipalities }, { data: customers }] = await Promise.all([
    supabase.from("municipalities").select("id, name"),
    supabase.from("customers").select("id, business_name, owner_name"),
  ]);
  const municipalityName = (municipalities ?? []).find((m) => m.id === topMunicipalityId)?.name;
  const customerLabel = (customers ?? []).find((c) => c.id === topCustomerId);
  const customerLabelById = new Map((customers ?? []).map((c) => [c.id, c.business_name || c.owner_name || "Customer"]));

  // Overdue / Due this week / Upcoming are non-overlapping buckets so each
  // task appears in exactly one widget (§8.2 lists them separately).
  const openTaskRows = (openTasks ?? []) as TaskWidgetRow[];
  const todaysTasks = openTaskRows.filter((t) => t.due_date === today);
  const overdueTasks = openTaskRows.filter((t) => t.due_date !== null && t.due_date < today);
  const dueThisWeekTasks = openTaskRows.filter(
    (t) => t.due_date !== null && t.due_date > today && t.due_date <= weekEnd
  );
  const upcomingTasks = openTaskRows.filter((t) => t.due_date === null || t.due_date > weekEnd);

  const kpi = kpiRows?.[0];
  const ownVolumeKg = (ownYearSales ?? []).reduce((s, r) => s + r.total_volume_kg, 0);
  const ownAccounts = new Set(
    (ownYearSales ?? []).filter((s) => s.customer_type !== "HH").map((s) => s.customer_id)
  ).size;

  const companyVolumeMt = kpi ? kgToMt(kpi.total_volume_kg) : 0;
  const targetMt = kpi?.volume_target_mt ?? 14.45;
  const companyPct = Math.min(companyVolumeMt / targetMt, 1);
  const ownPct = Math.min(kgToMt(ownVolumeKg) / targetMt, 1);

  const heatmapByDate = new Map<string, number>();
  for (const s of heatmapSales ?? []) {
    heatmapByDate.set(s.sale_date, (heatmapByDate.get(s.sale_date) ?? 0) + s.total_volume_kg);
  }
  const maxHeat = Math.max(1, ...heatmapByDate.values());
  const heatmapDays = Array.from({ length: 30 }, (_, i) => daysAgoDateString(29 - i));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{dspName}</h1>
          <p className="text-sm text-muted-foreground">Your territory at a glance</p>
        </div>
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

      {/* Rolling stock widget — top of screen, always visible (§8.2) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Your rolling stock</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/stock/issuances">Issuances</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stockSummary.stock.map((s) => (
              <div key={s.itemName}>
                <div className="text-xs text-muted-foreground">{s.itemName}</div>
                <div className="text-lg font-semibold tabular-nums">{formatCount(s.balance)}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Empties held:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCount(
                  stockSummary.empties.find((e) => e.itemType === "canister_shell")?.balance ?? 0
                )}{" "}
                shells
              </span>
            </span>
            {stockSummary.pendingIssuances.length > 0 ? (
              <Badge variant="warning">
                {stockSummary.pendingIssuances.length} pending issuance
                {stockSummary.pendingIssuances.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
            <span className="text-muted-foreground">
              Last count:{" "}
              {stockSummary.lastCountDate
                ? formatDate(new Date(stockSummary.lastCountDate), "MMM d, yyyy")
                : "never"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Task widgets (§8.2) */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Your tasks</h2>
        <Link href="/tasks" className="text-xs text-muted-foreground hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TaskWidget
          title="Today"
          icon={ListTodo}
          tasks={todaysTasks}
          quickComplete
          customerLabelById={customerLabelById}
        />
        <TaskWidget
          title="Overdue"
          icon={TriangleAlert}
          tasks={overdueTasks}
          quickComplete
          customerLabelById={customerLabelById}
        />
        <TaskWidget
          title="Due this week"
          icon={Clock}
          tasks={dueThisWeekTasks}
          quickComplete
          customerLabelById={customerLabelById}
        />
        <TaskWidget
          title="Upcoming"
          icon={CalendarClock}
          tasks={upcomingTasks}
          quickComplete
          customerLabelById={customerLabelById}
        />
        <TaskWidget
          title="Recently completed"
          icon={CheckCircle2}
          tasks={(recentlyCompletedTasks ?? []) as TaskWidgetRow[]}
          quickComplete={false}
          customerLabelById={customerLabelById}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress to company KPI · {year}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Volume</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMt(companyVolumeMt)} / {formatMt(targetMt)} · {formatPercent(companyPct)}
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: `${companyPct * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${ownPct * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your contribution: {formatMt(kgToMt(ownVolumeKg))} ({formatCount(ownAccounts)} accounts this year)
            </p>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Accounts</span>
              <span className="tabular-nums text-muted-foreground">
                {kpi?.total_accounts ?? 0} / {kpi?.accounts_target ?? 300}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min((kpi?.total_accounts ?? 0) / (kpi?.accounts_target ?? 300), 1) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <StaggerGrid className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StaggerItem>
          <StatCard label="Revenue" value={totalAmount} format="currency" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Volume" value={totalVolumeKg} format="kg" sub={formatMt(kgToMt(totalVolumeKg))} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Canisters" value={totalCanisters} format="count" sub={`${formatCount(totalCrates)} crates`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Accounts reached" value={uniqueAccounts} format="count" sub={`${repeatPurchases} repeat`} />
        </StaggerItem>
      </StaggerGrid>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top this period</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Municipality</span>
              <span className="font-medium">{municipalityName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{customerLabel ? customerLabel.business_name || customerLabel.owner_name : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-1">
              {heatmapDays.map((d) => {
                const v = heatmapByDate.get(d) ?? 0;
                const intensity = v / maxHeat;
                return (
                  <div
                    key={d}
                    title={`${d}: ${formatKg(v)}`}
                    className="aspect-square rounded-sm"
                    style={{
                      backgroundColor: v === 0 ? "var(--muted)" : `color-mix(in oklch, var(--primary) ${Math.max(intensity * 100, 15)}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-6">
          {(recentSales ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/sales/${s.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
            >
              <div>
                <div className="font-medium">{customerLabelById.get(s.customer_id) ?? "Customer"}</div>
                <div className="text-xs text-muted-foreground">{s.sale_date} · {s.receipt_no}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={s.payment_status === "paid" ? "success" : s.payment_status === "partial" ? "warning" : "destructive"}
                  className="capitalize"
                >
                  {s.payment_status}
                </Badge>
                <span className="tabular-nums font-medium">{formatCurrency(s.total_amount)}</span>
              </div>
            </Link>
          ))}
          {(recentSales ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
