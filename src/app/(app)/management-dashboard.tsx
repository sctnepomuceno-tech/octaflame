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
import { ManagementTier2 } from "./management-tier2";

const CURRENT_YEAR = new Date().getFullYear();

function KpiCard({
  title,
  actual,
  target,
  format,
  targetLabel,
  summary,
}: {
  title: string;
  actual: number;
  target: number;
  format: "count" | "mt";
  targetLabel: string;
  summary: string;
}) {
  const pace = computeKpiPace(actual, target);
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

  const { data: kpiRows } = await supabase.rpc("company_kpi_progress", { p_year: CURRENT_YEAR });
  const kpi = kpiRows?.[0];

  const accountsTarget = kpi?.accounts_target ?? 300;
  const volumeTargetMt = kpi?.volume_target_mt ?? 14.45;
  const totalAccounts = kpi?.total_accounts ?? 0;
  const totalVolumeMt = kpi ? kgToMt(kpi.total_volume_kg) : 0;

  const accountsPace = computeKpiPace(totalAccounts, accountsTarget);
  const volumePace = computeKpiPace(totalVolumeMt, volumeTargetMt);
  const requiredKgPerMonth = volumePace.requiredPerMonth * 1000;
  const requiredCratesPerMonth =
    requiredKgPerMonth / (volumeConstants.kgPerCanister * volumeConstants.canistersPerCrate);

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

      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <ExceptionsStrip />
      </Suspense>

      <Suspense fallback={<Tier2Skeleton />} key={period}>
        <ManagementTier2 period={period} />
      </Suspense>
    </div>
  );
}
