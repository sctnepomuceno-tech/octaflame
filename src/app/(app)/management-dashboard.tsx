import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getVolumeConstants } from "@/lib/volume/constants";
import { formatCount } from "@/lib/volume/format";
import { computeKpiPace, accountsPaceSummary } from "@/lib/kpi";
import { todayDateString, type Period } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StaggerGrid, StaggerItem } from "@/components/motion/stagger-grid";
import { cn } from "@/lib/utils";
import { ManagementTier2 } from "./management-tier2";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "wtd", label: "WTD" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
];

/** "36,000 pcs (1,500 crates)" — the two units the business actually tracks volume in now. */
function formatPcsAndCrates(canisters: number, canistersPerCrate: number): string {
  return `${formatCount(canisters)} pcs (${formatCount(canisters / canistersPerCrate)} crates)`;
}

function KpiCard({
  title,
  actual,
  targetLabel,
  summary,
  progressPct,
  onTrack,
}: {
  title: string;
  actual: number;
  targetLabel: string;
  summary: string;
  progressPct: number;
  onTrack: boolean;
}) {
  const pct = Math.min(progressPct, 1);

  return (
    <Card className="p-6">
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Badge variant={onTrack ? "success" : "warning"}>{onTrack ? "On track" : "Behind"}</Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            <AnimatedNumber value={actual} format="count" />
          </span>
          <span className="text-lg text-muted-foreground">/ {targetLabel}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={onTrack ? "h-full bg-success" : "h-full bg-warning"} style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </CardContent>
    </Card>
  );
}

async function ExceptionsStrip() {
  const supabase = await createClient();
  const today = todayDateString();

  const [
    { count: pendingIssuances },
    { data: dsps },
    { data: dspsWithSaleToday },
    { data: emptiesThreshold },
    { data: overOwedCustomers },
    { data: stockVarianceThreshold },
    { count: overdueTaskCount },
  ] = await Promise.all([
    supabase.from("stock_issuances").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("dsps").select("id, name").eq("active", true),
    supabase.from("sales").select("dsp_id").eq("sale_date", today),
    supabase.from("settings").select("value").eq("key", "empties_balance_notification_threshold").single(),
    supabase.from("customer_empties_balance").select("customer_id, balance").eq("item_type", "canister_shell"),
    supabase.from("settings").select("value").eq("key", "stock_variance_notification_threshold").single(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"])
      .lt("due_date", today),
  ]);

  const { data: reconciliation } = await supabase.from("dsp_stock_reconciliation").select("variance");

  const dspIdsWithSale = new Set((dspsWithSaleToday ?? []).map((s) => s.dsp_id));
  const dspsQuiet = (dsps ?? []).filter((d) => !dspIdsWithSale.has(d.id));

  const emptiesLimit = Number(emptiesThreshold?.value ?? 20);
  const customersOverThreshold = (overOwedCustomers ?? []).filter((c) => c.balance > emptiesLimit);

  const varianceLimit = Number(stockVarianceThreshold?.value ?? 10);
  const variancesOverThreshold = (reconciliation ?? []).filter(
    (r) => r.variance !== null && Math.abs(r.variance) > varianceLimit
  );

  const { data: items } = await supabase.from("inventory_items").select("id, reorder_level").eq("active", true);
  const { data: balances } = await supabase.from("dsp_stock_balance").select("item_id, balance");
  const balanceByItem = new Map<string, number>();
  for (const b of balances ?? []) {
    balanceByItem.set(b.item_id, (balanceByItem.get(b.item_id) ?? 0) + b.balance);
  }
  const belowReorder = (items ?? []).filter((i) => (balanceByItem.get(i.id) ?? 0) < i.reorder_level);

  const exceptions = [
    { label: "Unacknowledged issuances", count: pendingIssuances ?? 0, href: "/stock/issuances" },
    { label: "DSPs with no sale today", count: dspsQuiet.length, href: "/" },
    { label: "Stock variances over threshold", count: variancesOverThreshold.length, href: "/stock/issuances" },
    { label: "Items below reorder", count: belowReorder.length, href: "/stock/issuances" },
    { label: "Customers owing empties", count: customersOverThreshold.length, href: "/customers" },
    { label: "Overdue tasks", count: overdueTaskCount ?? 0, href: "/tasks" },
  ];

  const total = exceptions.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success-foreground">
        <CheckCircle2 className="size-4 text-success" />
        Everything&apos;s clean — nothing needs attention.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {exceptions
        .filter((e) => e.count > 0)
        .map((e) => (
          <Link
            key={e.label}
            href={e.href}
            className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm hover:bg-warning/10"
          >
            <AlertTriangle className="size-3.5 text-warning" />
            <span className="font-semibold tabular-nums">{e.count}</span>
            <span className="text-muted-foreground">{e.label}</span>
          </Link>
        ))}
    </div>
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-start weeks (matches periodStartDate's "wtd") whose Monday falls in that month. */
function mondaysInMonth(year: number, month: number): number {
  let count = 0;
  const last = daysInMonth(year, month);
  for (let day = 1; day <= last; day++) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1) count++;
  }
  return Math.max(1, count);
}

function mondayOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pace over a window of `totalUnits` days (a month or a week), not computeKpiPace's annual cycle. */
function windowPaceSummary(
  actual: number,
  target: number,
  unitsElapsed: number,
  totalUnits: number,
  unitLabel: string,
  perUnit: string
): { summary: string; progressPct: number; onTrack: boolean } {
  const expectedPct = unitsElapsed / totalUnits;
  const progressPct = target > 0 ? actual / target : 0;
  const onTrack = progressPct >= expectedPct;
  const unitsLeft = Math.max(0, totalUnits - unitsElapsed);

  if (onTrack) {
    return {
      progressPct,
      onTrack,
      summary:
        unitsLeft > 0
          ? `On pace — ${unitsLeft} ${unitLabel}${unitsLeft === 1 ? "" : "s"} left.`
          : "Window complete.",
    };
  }
  const remaining = Math.max(0, target - actual);
  const perUnitNeeded = unitsLeft > 0 ? remaining / unitsLeft : remaining;
  return {
    progressPct,
    onTrack,
    summary: `Behind pace — needs ~${Math.ceil(perUnitNeeded).toLocaleString()} ${perUnit} for the remaining ${unitsLeft} ${unitLabel}${unitsLeft === 1 ? "" : "s"}.`,
  };
}

function Tier2Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export async function ManagementDashboard({ period }: { period: Period }) {
  const supabase = await createClient();
  const volumeConstants = await getVolumeConstants();
  const canistersPerCrate = volumeConstants.canistersPerCrate;

  const now = new Date();
  const weekStart = mondayOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekOwnerMonth = weekStart.getUTCMonth() + 1;
  const weekOwnerYear = weekStart.getUTCFullYear();
  const dayOfWeek1to7 = now.getUTCDay() === 0 ? 7 : now.getUTCDay();

  const [{ data: kpiRows }, { data: monthlyRows }, { data: weekSales }] = await Promise.all([
    supabase.rpc("company_kpi_progress", { p_year: CURRENT_YEAR }),
    supabase.rpc("company_kpi_progress_monthly", { p_year: CURRENT_YEAR, p_month: CURRENT_MONTH }),
    supabase
      .from("sales")
      .select("total_volume_kg")
      .gte("sale_date", toDateString(weekStart))
      .lte("sale_date", toDateString(weekEnd))
      .is("deleted_at", null),
  ]);
  const kpi = kpiRows?.[0];
  const monthlyKpi = monthlyRows?.[0];

  const accountsTarget = kpi?.accounts_target ?? 500;
  const totalAccounts = kpi?.total_accounts ?? 0;
  const accountsPace = computeKpiPace(totalAccounts, accountsTarget);

  const annualCanistersTarget = kpi?.canisters_target ?? null;
  const annualCanistersActual = kpi ? kpi.total_volume_kg / volumeConstants.kgPerCanister : 0;

  const monthName = MONTH_NAMES[CURRENT_MONTH - 1];
  const monthlyCanistersTarget = monthlyKpi?.canisters_target ?? null;
  const monthlyCanistersActual = monthlyKpi ? monthlyKpi.total_volume_kg / volumeConstants.kgPerCanister : 0;
  const monthlyPace = monthlyCanistersTarget
    ? windowPaceSummary(
        monthlyCanistersActual,
        monthlyCanistersTarget,
        now.getUTCDate(),
        daysInMonth(CURRENT_YEAR, CURRENT_MONTH),
        "day",
        "pcs/day"
      )
    : null;

  const weekCanistersActual = (weekSales ?? []).reduce((sum, s) => sum + s.total_volume_kg, 0) / volumeConstants.kgPerCanister;
  // The week's target rides on whichever month owns its Monday — if that
  // month has no target set, there's nothing to show a weekly card against.
  const weekMonthlyTarget =
    weekOwnerYear === CURRENT_YEAR && weekOwnerMonth === CURRENT_MONTH ? monthlyCanistersTarget : null;
  const weeklyCanistersTarget = weekMonthlyTarget
    ? weekMonthlyTarget / mondaysInMonth(weekOwnerYear, weekOwnerMonth)
    : null;
  const weeklyPace = weeklyCanistersTarget
    ? windowPaceSummary(weekCanistersActual, weeklyCanistersTarget, dayOfWeek1to7, 7, "day", "pcs/day")
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Management</h1>
        <p className="text-sm text-muted-foreground">Are we on track? What needs me today?</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{CURRENT_YEAR} overview</h2>
        <Link href="/settings/kpi-targets" className="text-xs text-muted-foreground hover:underline">
          Edit KPI targets
        </Link>
      </div>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <KpiCard
            title="Unique RTL + WS accounts"
            actual={totalAccounts}
            targetLabel={formatCount(accountsTarget)}
            summary={accountsPaceSummary(accountsPace)}
            progressPct={accountsPace.progressPct}
            onTrack={accountsPace.paceStatus === "on_track"}
          />
        </StaggerItem>
        <StaggerItem>
          <Card className="p-6">
            <CardContent className="flex flex-col gap-2 p-0">
              <span className="text-sm font-medium text-muted-foreground">Volume (year to date)</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatPcsAndCrates(annualCanistersActual, canistersPerCrate)}
              </span>
              <p className="text-sm text-muted-foreground">
                {annualCanistersTarget
                  ? `Against ${formatPcsAndCrates(annualCanistersTarget, canistersPerCrate)} summed from this year's monthly targets.`
                  : "No monthly targets set yet this year — set them in KPI Targets."}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Volume targets</h2>
      </div>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          {monthlyPace ? (
            <KpiCard
              title={`${monthName} (this month)`}
              actual={monthlyCanistersActual}
              targetLabel={formatPcsAndCrates(monthlyCanistersTarget!, canistersPerCrate)}
              summary={monthlyPace.summary}
              progressPct={monthlyPace.progressPct}
              onTrack={monthlyPace.onTrack}
            />
          ) : (
            <Card className="p-6">
              <CardContent className="p-0 text-sm text-muted-foreground">
                No target set for {monthName} yet.{" "}
                <Link href="/settings/kpi-targets" className="underline">
                  Set one →
                </Link>
              </CardContent>
            </Card>
          )}
        </StaggerItem>
        <StaggerItem>
          {weeklyPace ? (
            <KpiCard
              title="This week (Mon–Sun)"
              actual={weekCanistersActual}
              targetLabel={formatPcsAndCrates(weeklyCanistersTarget!, canistersPerCrate)}
              summary={weeklyPace.summary}
              progressPct={weeklyPace.progressPct}
              onTrack={weeklyPace.onTrack}
            />
          ) : (
            <Card className="p-6">
              <CardContent className="p-0 text-sm text-muted-foreground">
                No target set for this week — set {monthName}&apos;s monthly target and the week
                splits evenly from it.
              </CardContent>
            </Card>
          )}
        </StaggerItem>
      </StaggerGrid>

      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <ExceptionsStrip />
      </Suspense>

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

      <Suspense fallback={<Tier2Skeleton />} key={period}>
        <ManagementTier2 period={period} />
      </Suspense>
    </div>
  );
}
