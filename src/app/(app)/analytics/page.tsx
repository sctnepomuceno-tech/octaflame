import type { Metadata } from "next";
import Link from "next/link";
import { subMonths, format as formatDate } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { todayInManila, todayDateString } from "@/lib/dates";
import { monthKey, addMonthsToKey, growthPct } from "@/lib/analytics";
import { formatCount, formatCurrency, formatKg, formatPercent } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "./sales-trend-chart";

export const metadata: Metadata = { title: "Analytics" };

const TREND_MONTHS = 12;
const HEATMAP_METRICS = [
  { value: "volume", label: "Volume" },
  { value: "revenue", label: "Revenue" },
  { value: "accounts", label: "Accounts" },
  { value: "growth", label: "Growth" },
] as const;
type HeatmapMetric = (typeof HEATMAP_METRICS)[number]["value"];

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

export default async function AnalyticsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("dashboard.management");
  const params = await props.searchParams;
  const heatmapMetric: HeatmapMetric =
    (HEATMAP_METRICS.find((m) => m.value === params.heatmap)?.value as HeatmapMetric) ?? "volume";

  const supabase = await createClient();
  const today = todayDateString();
  const trendStart = formatDate(subMonths(todayInManila(), TREND_MONTHS - 1), "yyyy-MM-01");
  const priorYearStart = formatDate(subMonths(todayInManila(), TREND_MONTHS - 1 + 12), "yyyy-MM-01");

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
      .gte("sale_date", priorYearStart)
      .lte("sale_date", today)
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
      .lte("movement_date", today),
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

  // --- Sales trend (last 12 months) -------------------------------------------
  const volumeByMonth = new Map<string, number>();
  for (const s of trendSales) {
    const k = monthKey(s.sale_date);
    volumeByMonth.set(k, (volumeByMonth.get(k) ?? 0) + s.total_volume_kg);
  }
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => addMonthsToKey(monthKey(trendStart), i));
  const trendData = trendMonths.map((k) => ({
    key: k,
    label: formatDate(new Date(`${k}-01T00:00:00`), "MMM"),
    value: volumeByMonth.get(k) ?? 0,
  }));

  // --- MoM / YoY growth ---------------------------------------------------------
  const latestMonth = trendMonths[trendMonths.length - 1];
  const previousMonth = addMonthsToKey(latestMonth, -1);
  const sameMonthLastYear = addMonthsToKey(latestMonth, -12);
  const volumeAllMonths = new Map<string, number>();
  for (const s of allSales) {
    const k = monthKey(s.sale_date);
    volumeAllMonths.set(k, (volumeAllMonths.get(k) ?? 0) + s.total_volume_kg);
  }
  const mom = growthPct(volumeAllMonths.get(latestMonth) ?? 0, volumeAllMonths.get(previousMonth) ?? 0);
  const yoy =
    volumeAllMonths.has(sameMonthLastYear) && (volumeAllMonths.get(sameMonthLastYear) ?? 0) > 0
      ? growthPct(volumeAllMonths.get(latestMonth) ?? 0, volumeAllMonths.get(sameMonthLastYear) ?? 0)
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
    .map(([id, v]) => ({ label: municipalityNameById.get(id) ?? "—", value: v }))
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

  // --- Deployment frequency (deployments per DSP per week, trailing 12mo) --------
  const deploymentCount = trendSales.filter((s) => s.deployment_date).length;
  const activeDspCount = Math.max(1, (dsps ?? []).length);
  const deploymentsPerDspPerWeek = deploymentCount / activeDspCount / (TREND_MONTHS * 4.345);

  // --- Customer acquisition curve (RTL/WS, cumulative toward the 300 target) -----
  const acquisitions = (customers ?? []).filter((c) => c.customer_type !== "HH" && c.first_purchase_date);
  const baselineCount = acquisitions.filter((c) => c.first_purchase_date! < trendStart).length;
  const acquisitionsByMonth = new Map<string, number>();
  for (const c of acquisitions) {
    if (c.first_purchase_date! < trendStart) continue;
    const k = monthKey(c.first_purchase_date!);
    acquisitionsByMonth.set(k, (acquisitionsByMonth.get(k) ?? 0) + 1);
  }
  let running = baselineCount;
  const acquisitionCurve = trendMonths.map((k) => {
    running += acquisitionsByMonth.get(k) ?? 0;
    return { key: k, label: formatDate(new Date(`${k}-01T00:00:00`), "MMM"), value: running };
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
  const priorTrendSales = allSales.filter((s) => s.sale_date >= priorYearStart && s.sale_date < trendStart);
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Trailing {TREND_MONTHS} months, company-wide.</p>
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
          <CardHeader>
            <CardTitle className="text-base">Volume trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} formatValue={formatKg} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer acquisition (RTL + WS, cumulative)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={acquisitionCurve} color="var(--accent)" formatValue={(v) => formatCount(v)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top municipalities</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedList rows={topMunicipalities} formatValue={formatKg} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top DSP</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="text-lg font-semibold">{topDsp ? dspNameById.get(topDsp[0]) : "—"}</div>
            <div className="text-sm text-muted-foreground">{topDsp ? formatKg(topDsp[1]) : "No sales yet"}</div>
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
                href={`/analytics?heatmap=${m.value}`}
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
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-1 rounded-md p-2 text-xs"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${isNegative ? "var(--destructive)" : "var(--primary)"} ${Math.max(intensity * 100, 8)}%, var(--muted))`,
                  }}
                >
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {heatmapMetric === "volume"
                      ? formatKg(r.volume)
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
