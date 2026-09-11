import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { kgToMt } from "@/lib/volume/calculations";
import { getVolumeConstants } from "@/lib/volume/constants";
import { formatCount, formatMt } from "@/lib/volume/format";
import { computeKpiPace, volumePaceSummary, accountsPaceSummary } from "@/lib/kpi";
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

function KpiCard({
  title,
  actual,
  target,
  format,
  targetLabel,
  summary,
  paceOverride,
}: {
  title: string;
  actual: number;
  target: number;
  format: "count" | "mt";
  targetLabel: string;
  summary: string;
  /** Override pace status/progress for non-annual targets (computeKpiPace assumes a full-year cycle). */
  paceOverride?: { progressPct: number; onTrack: boolean };
}) {
  const pace = paceOverride
    ? { progressPct: paceOverride.progressPct, paceStatus: paceOverride.onTrack ? "on_track" as const : "behind" as const }
    : computeKpiPace(actual, target);
  const pct = Math.min(pace.progressPct, 1);

  return (
    <Card className="p-6">
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Badge variant={pace.paceStatus === "on_track" ? "success" : "warning"}>
            {pace.paceStatus === "on_track" ? "On track" : "Behind"}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            <AnimatedNumber value={actual} format={format} />
          </span>
          <span className="text-lg text-muted-foreground">/ {targetLabel}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={pace.paceStatus === "on_track" ? "h-full bg-success" : "h-full bg-warning"}
            style={{ width: `${pct * 100}%` }}
          />
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

/** Monthly targets pace over a single month, not the annual cycle computeKpiPace assumes. */
function monthlyPaceSummary(actual: number, target: number, year: number, month: number, unit: string): string {
  const totalDays = daysInMonth(year, month);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const dayOfMonth = isCurrentMonth ? now.getDate() : totalDays;
  const expectedPct = dayOfMonth / totalDays;
  const progressPct = target > 0 ? actual / target : 0;
  const daysLeft = Math.max(0, totalDays - dayOfMonth);

  if (progressPct >= expectedPct) {
    return daysLeft > 0
      ? `On pace — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left this month.`
      : "Month complete.";
  }
  const remaining = Math.max(0, target - actual);
  const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  return `Behind pace — needs ~${perDay.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}/day for the remaining ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
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

  const [{ data: kpiRows }, { data: monthlyRows }] = await Promise.all([
    supabase.rpc("company_kpi_progress", { p_year: CURRENT_YEAR }),
    supabase.rpc("company_kpi_progress_monthly", { p_year: CURRENT_YEAR, p_month: CURRENT_MONTH }),
  ]);
  const kpi = kpiRows?.[0];
  const monthlyKpi = monthlyRows?.[0];

  const accountsTarget = kpi?.accounts_target ?? 300;
  const volumeTargetMt = kpi?.volume_target_mt ?? 14.45;
  const totalAccounts = kpi?.total_accounts ?? 0;
  const totalVolumeMt = kpi ? kgToMt(kpi.total_volume_kg) : 0;

  const accountsPace = computeKpiPace(totalAccounts, accountsTarget);
  const volumePace = computeKpiPace(totalVolumeMt, volumeTargetMt);
  const requiredKgPerMonth = volumePace.requiredPerMonth * 1000;
  const requiredCratesPerMonth =
    requiredKgPerMonth / (volumeConstants.kgPerCanister * volumeConstants.canistersPerCrate);

  const monthlyVolumeMt = monthlyKpi ? kgToMt(monthlyKpi.total_volume_kg) : 0;
  const monthName = MONTH_NAMES[CURRENT_MONTH - 1];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Management</h1>
        <p className="text-sm text-muted-foreground">Are we on track? What needs me today?</p>
      </div>

      <StaggerGrid className="grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <KpiCard
            title="Unique RTL + WS accounts"
            actual={totalAccounts}
            target={accountsTarget}
            format="count"
            targetLabel={formatCount(accountsTarget)}
            summary={accountsPaceSummary(accountsPace)}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Volume"
            actual={totalVolumeMt}
            target={volumeTargetMt}
            format="mt"
            targetLabel={formatMt(volumeTargetMt)}
            summary={volumePaceSummary(volumePace, volumeTargetMt, requiredCratesPerMonth, formatMt)}
          />
        </StaggerItem>
      </StaggerGrid>

      {monthlyKpi ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{monthName} target</h2>
            <Link href="/settings/kpi-targets" className="text-xs text-muted-foreground hover:underline">
              Edit KPI targets
            </Link>
          </div>
          <StaggerGrid className="grid gap-4 sm:grid-cols-2">
            <StaggerItem>
              <KpiCard
                title={`${monthName} accounts`}
                actual={monthlyKpi.total_accounts}
                target={monthlyKpi.accounts_target}
                format="count"
                targetLabel={formatCount(monthlyKpi.accounts_target)}
                summary={monthlyPaceSummary(
                  monthlyKpi.total_accounts,
                  monthlyKpi.accounts_target,
                  CURRENT_YEAR,
                  CURRENT_MONTH,
                  "accounts"
                )}
                paceOverride={{
                  progressPct: monthlyKpi.accounts_target > 0 ? monthlyKpi.total_accounts / monthlyKpi.accounts_target : 0,
                  onTrack: monthlyKpi.total_accounts >= monthlyKpi.accounts_target * (new Date().getDate() / daysInMonth(CURRENT_YEAR, CURRENT_MONTH)),
                }}
              />
            </StaggerItem>
            <StaggerItem>
              <KpiCard
                title={`${monthName} volume`}
                actual={monthlyVolumeMt}
                target={monthlyKpi.volume_target_mt}
                format="mt"
                targetLabel={formatMt(monthlyKpi.volume_target_mt)}
                summary={monthlyPaceSummary(monthlyVolumeMt, monthlyKpi.volume_target_mt, CURRENT_YEAR, CURRENT_MONTH, "MT")}
                paceOverride={{
                  progressPct: monthlyKpi.volume_target_mt > 0 ? monthlyVolumeMt / monthlyKpi.volume_target_mt : 0,
                  onTrack: monthlyVolumeMt >= monthlyKpi.volume_target_mt * (new Date().getDate() / daysInMonth(CURRENT_YEAR, CURRENT_MONTH)),
                }}
              />
            </StaggerItem>
          </StaggerGrid>
        </div>
      ) : (
        <Link
          href="/settings/kpi-targets"
          className="text-xs text-muted-foreground hover:underline"
        >
          Set a target for {monthName} to see this month&apos;s KPI here →
        </Link>
      )}

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
