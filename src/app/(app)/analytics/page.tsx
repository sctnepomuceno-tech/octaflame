import type { Metadata } from "next";
import Link from "next/link";
import { subMonths, subWeeks, addWeeks, startOfMonth, startOfWeek, format as formatDate } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getVolumeConstants } from "@/lib/volume/constants";
import { todayDateString, monthRange } from "@/lib/dates";
import { monthKey, addMonthsToKey, growthPct, recentMonthOptions } from "@/lib/analytics";
import { formatCanisters, formatCount, formatCurrency, formatPercent, formatPcsAndCrates } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "./sales-trend-chart";
import { MonthSelect } from "../month-select";

export const metadata: Metadata = { title: "Analytics" };

const TREND_MONTHS = 12;
const HEATMAP_METRICS = [
  { value: "volume", label: "Volume" },
  { value: "revenue", label: "Revenue" },
  { value: "accounts", label: "Accounts" },
  { value: "growth", label: "Growth" },
] as const;
type HeatmapMetric = (typeof HEATMAP_METRICS)[number]["value"];

const OVERVIEW_METRICS = [
  { value: "volume", label: "Volume (pcs)" },
  { value: "accounts", label: "New accounts" },
] as const;
type OverviewMetric = (typeof OVERVIEW_METRICS)[number]["value"];

const GRANULARITIES = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
] as const;
type Granularity = (typeof GRANULARITIES)[number]["value"];
const TREND_PERIODS: Record<Granularity, number> = { month: TREND_MONTHS, week: 12 };

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function RankedList({
  rows,
  formatValue,
}: {
  rows: { label: string; value: number }[];
  formatValue: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate">{r.label}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {formatValue(r.value)}
          </span>
        </div>
      ))}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : null}
    </div>
  );
}

function periodKeyFor(dateStr: string, granularity: Granularity): string {
  if (granularity === "month") return monthKey(dateStr);
  return formatDate(startOfWeek(new Date(`${dateStr}T00:00:00`), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function addPeriods(key: string, n: number, granularity: Granularity): string {
  if (granularity === "month") return addMonthsToKey(key, n);
  return formatDate(addWeeks(new Date(`${key}T00:00:00`), n), "yyyy-MM-dd");
}

function periodLabel(key: string, granularity: Granularity): string {
  return formatDate(new Date(`${key}T00:00:00`), granularity === "month" ? "MMM" : "MMM d");
}

export default async function AnalyticsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("dashboard.management");
  const params = await props.searchParams;
  const heatmapMetric: HeatmapMetric =
    (HEATMAP_METRICS.find((m) => m.value === params.heatmap)?.value as HeatmapMetric) ?? "volume";
  const overviewMetric: OverviewMetric =
    (OVERVIEW_METRICS.find((m) => m.value === params.overview)?.value as OverviewMetric) ?? "volume";
  const granularity: Granularity =
    (GRANULARITIES.find((g) => g.value === params.granularity)?.value as Granularity) ?? "month";

  const supabase = await createClient();
  const volumeConstants = await getVolumeConstants();
  const kgPerCanister = volumeConstants.kgPerCanister;
  const canistersPerCrate = volumeConstants.canistersPerCrate;
  const today = todayDateString();
  const trendPeriods = TREND_PERIODS[granularity];

  // Which month the trailing window ends at — defaults to the current
  // month, but can be wound back so the whole page re-views an earlier
  // period instead of always ending "now".
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const selectedMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey(today);
  const isCurrentMonth = selectedMonth === monthKey(today);
  const anchorDate = isCurrentMonth ? today : monthRange(selectedMonth).end;
  const anchor = new Date(`${anchorDate}T00:00:00`);

  // The trend window itself follows the chosen granularity (trailing 12
  // weeks vs. trailing 12 months), but MoM/YoY below always compares real
  // calendar months relative to the selected month regardless — so the
  // fetch has to reach back far enough for that even when the window on
  // screen is just a few weeks.
  const trendStartDate =
    granularity === "week"
      ? startOfWeek(subWeeks(anchor, trendPeriods - 1), { weekStartsOn: 1 })
      : startOfMonth(subMonths(anchor, trendPeriods - 1));
  const trendStart = formatDate(trendStartDate, "yyyy-MM-dd");
  const priorWindowStart = formatDate(
    granularity === "week" ? subWeeks(trendStartDate, trendPeriods) : subMonths(trendStartDate, trendPeriods),
    "yyyy-MM-dd"
  );
  const yoyFloorStart = formatDate(subMonths(anchor, 13), "yyyy-MM-01");
  const fetchStart = priorWindowStart < yoyFloorStart ? priorWindowStart : yoyFloorStart;

  const [
    { data: sales },
    { data: customers },
    { data: dsps },
    { data: municipalities },
    { data: products },
    { data: soldMovements },
    { data: stockBalances },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_date, deployment_date, dsp_id, municipality_id, customer_id, customer_type, total_volume_kg, total_amount, is_repeat_purchase")
      .gte("sale_date", fetchStart)
      .lte("sale_date", anchorDate)
      .is("deleted_at", null),
    supabase.from("customers").select("first_purchase_date, customer_type, dsp_id").is("deleted_at", null),
    supabase.from("dsps").select("id, name").eq("active", true),
    supabase.from("municipalities").select("id, name").eq("active", true).order("name"),
    supabase.from("products").select("id, name"),
    supabase
      .from("dsp_stock_movements")
      .select("quantity")
      .eq("movement_type", "sold")
      .gte("movement_date", trendStart)
      .lte("movement_date", anchorDate),
    supabase.from("dsp_stock_balance").select("balance"),
  ]);

  const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));
  const municipalityNameById = new Map((municipalities ?? []).map((m) => [m.id, m.name]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  const allSales = sales ?? [];
  const trendSales = allSales.filter((s) => s.sale_date >= trendStart);

  const trendSaleIds = trendSales.map((s) => s.id);
  const { data: saleItems } = trendSaleIds.length
    ? await supabase.from("sale_items").select("product_id, line_total").in("sale_id", trendSaleIds)
    : { data: [] as { product_id: string; line_total: number }[] };

  // --- Sales trend (trailing weeks or months, per the granularity toggle) ------
  const volumeByPeriod = new Map<string, number>();
  for (const s of trendSales) {
    const k = periodKeyFor(s.sale_date, granularity);
    volumeByPeriod.set(k, (volumeByPeriod.get(k) ?? 0) + s.total_volume_kg);
  }
  const trendPeriodKeys = Array.from({ length: trendPeriods }, (_, i) =>
    addPeriods(periodKeyFor(trendStart, granularity), i, granularity)
  );
  const trendData = trendPeriodKeys.map((k) => ({
    key: k,
    label: periodLabel(k, granularity),
    value: (volumeByPeriod.get(k) ?? 0) / kgPerCanister,
  }));

  // --- MoM / YoY growth (always real calendar months around the selected
  // month, independent of the chart's week/month granularity above) -----------
  const currentMonth = selectedMonth;
  const previousMonth = addMonthsToKey(currentMonth, -1);
  const sameMonthLastYear = addMonthsToKey(currentMonth, -12);
  const volumeAllMonths = new Map<string, number>();
  for (const s of allSales) {
    const k = monthKey(s.sale_date);
    volumeAllMonths.set(k, (volumeAllMonths.get(k) ?? 0) + s.total_volume_kg);
  }
  const mom = growthPct(volumeAllMonths.get(currentMonth) ?? 0, volumeAllMonths.get(previousMonth) ?? 0);
  const yoy =
    volumeAllMonths.has(sameMonthLastYear) && (volumeAllMonths.get(sameMonthLastYear) ?? 0) > 0
      ? growthPct(volumeAllMonths.get(currentMonth) ?? 0, volumeAllMonths.get(sameMonthLastYear) ?? 0)
      : null;

  // --- Repeat customer % --------------------------------------------------------
  const repeatRate = trendSales.length > 0 ? trendSales.filter((s) => s.is_repeat_purchase).length / trendSales.length : 0;

  // --- Top municipalities / DSP / products ---------------------------------------
  const municipalityAgg = new Map<string, number>();
  const dspAgg = new Map<string, number>();
  for (const s of trendSales) {
    municipalityAgg.set(s.municipality_id, (municipalityAgg.get(s.municipality_id) ?? 0) + s.total_volume_kg);
    dspAgg.set(s.dsp_id, (dspAgg.get(s.dsp_id) ?? 0) + s.total_volume_kg);
  }
  const topMunicipalities = [...municipalityAgg.entries()]
    .map(([id, v]) => ({ label: municipalityNameById.get(id) ?? "—", value: v / kgPerCanister }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const topDsp = [...dspAgg.entries()].sort((a, b) => b[1] - a[1])[0];

  const productAgg = new Map<string, number>();
  for (const item of saleItems ?? []) {
    productAgg.set(item.product_id, (productAgg.get(item.product_id) ?? 0) + item.line_total);
  }
  const topProducts = [...productAgg.entries()]
    .map(([id, v]) => ({ label: productNameById.get(id) ?? "—", value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // --- Inventory turnover (sold ÷ current avg-on-hand proxy) ----------------------
  const totalSoldUnits = (soldMovements ?? []).reduce((s, m) => s + m.quantity, 0);
  const currentStockOnHand = (stockBalances ?? []).reduce((s, b) => s + Math.max(b.balance, 0), 0);
  const inventoryTurnover = currentStockOnHand > 0 ? totalSoldUnits / currentStockOnHand : null;

  // --- Deployment frequency (deployments per DSP per week, trailing window) ------
  const deploymentCount = trendSales.filter((s) => s.deployment_date).length;
  const activeDspCount = Math.max(1, (dsps ?? []).length);
  const trendWindowWeeks = granularity === "week" ? trendPeriods : trendPeriods * 4.345;
  const deploymentsPerDspPerWeek = deploymentCount / activeDspCount / trendWindowWeeks;

  // --- Customer acquisition curve (RTL/WS, cumulative toward the 300 target) -----
  // Matches company_kpi_progress's definition exactly — SD (Subdealer)
  // accounts are real business accounts but aren't part of this specific
  // 300-account target, so they're excluded here even though other
  // "any business account" aggregations on this page treat SD like RTL/WS.
  const acquisitions = (customers ?? []).filter(
    (c) => (c.customer_type === "RTL" || c.customer_type === "WS") && c.first_purchase_date
  );
  const baselineCount = acquisitions.filter((c) => c.first_purchase_date! < trendStart).length;
  const acquisitionsByPeriod = new Map<string, number>();
  for (const c of acquisitions) {
    if (c.first_purchase_date! < trendStart) continue;
    const k = periodKeyFor(c.first_purchase_date!, granularity);
    acquisitionsByPeriod.set(k, (acquisitionsByPeriod.get(k) ?? 0) + 1);
  }
  let running = baselineCount;
  const acquisitionCurve = trendPeriodKeys.map((k) => {
    running += acquisitionsByPeriod.get(k) ?? 0;
    return { key: k, label: periodLabel(k, granularity), value: running };
  });
  const periodAccountsData = trendPeriodKeys.map((k) => {
    return { key: k, label: periodLabel(k, granularity), value: acquisitionsByPeriod.get(k) ?? 0 };
  });

  // --- Municipality heatmap -------------------------------------------------------
  const municipalityRevenue = new Map<string, number>();
  const municipalityAccounts = new Map<string, Set<string>>();
  const municipalityPrevVolume = new Map<string, number>();
  for (const s of trendSales) {
    municipalityRevenue.set(s.municipality_id, (municipalityRevenue.get(s.municipality_id) ?? 0) + s.total_amount);
    if (s.customer_type !== "HH") {
      const set = municipalityAccounts.get(s.municipality_id) ?? new Set<string>();
      set.add(s.customer_id);
      municipalityAccounts.set(s.municipality_id, set);
    }
  }
  const priorTrendSales = allSales.filter((s) => s.sale_date >= priorWindowStart && s.sale_date < trendStart);
  for (const s of priorTrendSales) {
    municipalityPrevVolume.set(s.municipality_id, (municipalityPrevVolume.get(s.municipality_id) ?? 0) + s.total_volume_kg);
  }

  const heatmapRows = (municipalities ?? []).map((m) => {
    const volume = municipalityAgg.get(m.id) ?? 0;
    const revenue = municipalityRevenue.get(m.id) ?? 0;
    const accounts = municipalityAccounts.get(m.id)?.size ?? 0;
    const growth = growthPct(volume, municipalityPrevVolume.get(m.id) ?? 0);
    const metricValue =
      heatmapMetric === "volume" ? volume : heatmapMetric === "revenue" ? revenue : heatmapMetric === "accounts" ? accounts : growth ?? 0;
    return { id: m.id, name: m.name, volume, revenue, accounts, growth, metricValue };
  });
  const maxMetric = Math.max(1, ...heatmapRows.map((r) => Math.abs(r.metricValue)));

  const withParam = (key: string, value: string) => {
    const sp = new URLSearchParams({ heatmap: heatmapMetric, overview: overviewMetric, granularity, month: selectedMonth });
    sp.set(key, value);
    return `/analytics?${sp.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Trailing {trendPeriods} {granularity === "week" ? "weeks" : "months"} through{" "}
            {isCurrentMonth ? "today" : formatDate(anchor, "MMMM yyyy")}, company-wide.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelect
            value={selectedMonth}
            options={recentMonthOptions(monthKey(today), 12)}
            basePath="/analytics"
            params={{ heatmap: heatmapMetric, overview: overviewMetric, granularity }}
          />
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {GRANULARITIES.map((g) => (
              <Link
                key={g.value}
                href={withParam("granularity", g.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  g.value === granularity ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {g.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="MoM growth"
          value={mom === null ? "—" : formatPercent(Math.abs(mom), 1)}
          sub={mom === null ? "No prior month" : mom >= 0 ? "up" : "down"}
        />
        <StatCard
          label="YoY growth"
          value={yoy === null ? "—" : formatPercent(Math.abs(yoy), 1)}
          sub={yoy === null ? "No prior-year data yet" : yoy >= 0 ? "up" : "down"}
        />
        <StatCard label="Repeat customer rate" value={formatPercent(repeatRate)} />
        <StatCard
          label="Inventory turnover"
          value={inventoryTurnover === null ? "—" : inventoryTurnover.toFixed(2)}
          sub="sold ÷ on-hand"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{granularity === "week" ? "Weekly" : "Monthly"} overview</CardTitle>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {OVERVIEW_METRICS.map((m) => (
                <Link
                  key={m.value}
                  href={withParam("overview", m.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    m.value === overviewMetric ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {overviewMetric === "volume" ? (
              <TrendChart data={trendData} formatKind="canisters" />
            ) : (
              <TrendChart data={periodAccountsData} color="var(--accent)" formatKind="count" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer acquisition (RTL + WS, cumulative)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={acquisitionCurve} color="var(--accent)" formatKind="count" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top municipalities</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedList rows={topMunicipalities} formatValue={formatCanisters} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top DSP</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="text-lg font-semibold">{topDsp ? dspNameById.get(topDsp[0]) : "—"}</div>
            <div className="text-sm text-muted-foreground">
              {topDsp ? formatPcsAndCrates(topDsp[1] / kgPerCanister, canistersPerCrate) : "No sales yet"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Deployments per DSP: ~{deploymentsPerDspPerWeek.toFixed(1)}/week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedList rows={topProducts} formatValue={formatCurrency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Municipality heatmap</CardTitle>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {HEATMAP_METRICS.map((m) => (
              <Link
                key={m.value}
                href={withParam("heatmap", m.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  m.value === heatmapMetric ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {heatmapRows.map((r) => {
              const intensity = Math.min(Math.abs(r.metricValue) / maxMetric, 1);
              const isNegative = r.metricValue < 0;
              // --primary is a dark, low-lightness navy (brand blue), so cells
              // blending toward it turn unreadable-with-black-text much sooner
              // than the lighter --destructive red does — pair white text with
              // blue cells earlier than red ones instead of one shared threshold.
              const isDark = isNegative ? intensity >= 0.55 : intensity >= 0.25;
              return (
                <div
                  key={r.id}
                  className={`flex flex-col gap-1 rounded-md p-2 text-xs ${isDark ? "text-white" : "text-foreground"}`}
                  style={{
                    backgroundColor: `color-mix(in oklch, ${isNegative ? "var(--destructive)" : "var(--primary)"} ${Math.max(intensity * 100, 8)}%, var(--muted))`,
                  }}
                >
                  <span className="truncate font-medium">{r.name}</span>
                  <span className={`tabular-nums ${isDark ? "text-white/80" : "text-muted-foreground"}`}>
                    {heatmapMetric === "volume"
                      ? formatCanisters(r.volume / kgPerCanister)
                      : heatmapMetric === "revenue"
                        ? formatCurrency(r.revenue)
                        : heatmapMetric === "accounts"
                          ? formatCount(r.accounts)
                          : r.growth === null
                            ? "—"
                            : `${r.growth >= 0 ? "+" : ""}${formatPercent(r.growth, 1)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {mom !== null && Math.abs(mom) === 0 && trendSales.length === 0 ? (
        <Badge variant="outline">No sales recorded in the trailing window yet.</Badge>
      ) : null}
    </div>
  );
}
