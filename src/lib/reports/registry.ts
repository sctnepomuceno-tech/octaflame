import { kgToMt } from "@/lib/volume/calculations";
import type { ReportDefinition } from "./types";

// ---------------------------------------------------------------------------
// 1. Daily Sales Summary (all DSPs)
// ---------------------------------------------------------------------------
interface DailySalesRow {
  date: string;
  dspName: string;
  transactions: number;
  canisters: number;
  volumeKg: number;
  revenue: number;
}

const dailySalesSummary: ReportDefinition<DailySalesRow> = {
  key: "daily-sales-summary",
  label: "Daily Sales Summary",
  description: "Every DSP's totals by day — transactions, canisters, volume, revenue.",
  columns: [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "dspName", header: "DSP", value: (r) => r.dspName },
    { key: "transactions", header: "Transactions", value: (r) => r.transactions, align: "right" },
    { key: "canisters", header: "Canisters", value: (r) => r.canisters, align: "right" },
    { key: "volumeKg", header: "Volume (kg)", value: (r) => r.volumeKg.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "revenue", header: "Revenue", value: (r) => r.revenue.toFixed(2), align: "right", numFmt: "₱#,##0.00" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("sales")
      .select("sale_date, dsp_id, total_canisters, total_volume_kg, total_amount")
      .gte("sale_date", ctx.filters.from)
      .lte("sale_date", ctx.filters.to)
      .is("deleted_at", null);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);
    if (ctx.filters.dspId) query = query.eq("dsp_id", ctx.filters.dspId);

    const [{ data: sales }, { data: dsps }] = await Promise.all([
      query,
      ctx.supabase.from("dsps").select("id, name"),
    ]);
    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

    const agg = new Map<string, DailySalesRow>();
    for (const s of sales ?? []) {
      const key = `${s.sale_date}__${s.dsp_id}`;
      const row = agg.get(key) ?? {
        date: s.sale_date,
        dspName: dspNameById.get(s.dsp_id) ?? "—",
        transactions: 0,
        canisters: 0,
        volumeKg: 0,
        revenue: 0,
      };
      row.transactions += 1;
      row.canisters += s.total_canisters;
      row.volumeKg += s.total_volume_kg;
      row.revenue += s.total_amount;
      agg.set(key, row);
    }
    const rows = [...agg.values()].sort((a, b) => a.date.localeCompare(b.date) || a.dspName.localeCompare(b.dspName));
    return {
      rows,
      summary: {
        "Total transactions": rows.reduce((s, r) => s + r.transactions, 0),
        "Total revenue": `₱${rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)}`,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 2. Monthly Volume vs KPI
// ---------------------------------------------------------------------------
interface MonthlyVolumeRow {
  month: string;
  actualMt: number;
  targetMt: number;
  status: string;
}

const monthlyVolumeVsKpi: ReportDefinition<MonthlyVolumeRow> = {
  key: "monthly-volume-vs-kpi",
  label: "Monthly Volume vs KPI",
  description: "Actual company volume against the pro-rated monthly target.",
  columns: [
    { key: "month", header: "Month", value: (r) => r.month },
    { key: "actualMt", header: "Actual (MT)", value: (r) => r.actualMt.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "targetMt", header: "Target (MT)", value: (r) => r.targetMt.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "status", header: "Status", value: (r) => r.status },
  ],
  async fetch(ctx) {
    const fromYear = new Date(ctx.filters.from).getFullYear();
    const toYear = new Date(ctx.filters.to).getFullYear();
    const years = [...new Set([fromYear, toYear])];

    const [{ data: sales }, { data: targets }] = await Promise.all([
      (async () => {
        let query = ctx.supabase
          .from("sales")
          .select("sale_date, total_volume_kg, dsp_id")
          .gte("sale_date", ctx.filters.from)
          .lte("sale_date", ctx.filters.to)
          .is("deleted_at", null);
        if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);
        return query;
      })(),
      ctx.supabase.from("kpi_targets").select("year, volume_target_mt").in("year", years).is("dsp_id", null),
    ]);

    const targetByYear = new Map((targets ?? []).map((t) => [t.year, t.volume_target_mt]));
    const byMonth = new Map<string, number>();
    for (const s of sales ?? []) {
      const key = s.sale_date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + s.total_volume_kg);
    }

    const rows = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, kg]) => {
        const year = Number(month.slice(0, 4));
        const yearTarget = targetByYear.get(year) ?? 14.45;
        const monthlyTarget = yearTarget / 12;
        const actualMt = kgToMt(kg);
        return {
          month,
          actualMt,
          targetMt: monthlyTarget,
          status: actualMt >= monthlyTarget ? "On track" : "Behind",
        };
      });

    return { rows };
  },
};

// ---------------------------------------------------------------------------
// 3. Customer Master List with lifetime volume
// ---------------------------------------------------------------------------
interface CustomerMasterRow {
  name: string;
  type: string;
  municipality: string;
  dsp: string;
  status: string;
  transactions: number;
  lifetimeVolumeKg: number;
  lifetimeAmount: number;
}

const customerMasterList: ReportDefinition<CustomerMasterRow> = {
  key: "customer-master-list",
  label: "Customer Master List",
  description: "Every customer with lifetime volume and amount.",
  columns: [
    { key: "name", header: "Customer", value: (r) => r.name },
    { key: "type", header: "Type", value: (r) => r.type },
    { key: "municipality", header: "Municipality", value: (r) => r.municipality },
    { key: "dsp", header: "DSP", value: (r) => r.dsp },
    { key: "status", header: "Status", value: (r) => r.status },
    { key: "transactions", header: "Transactions", value: (r) => r.transactions, align: "right" },
    { key: "lifetimeVolumeKg", header: "Lifetime volume (kg)", value: (r) => r.lifetimeVolumeKg.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "lifetimeAmount", header: "Lifetime amount", value: (r) => r.lifetimeAmount.toFixed(2), align: "right", numFmt: "₱#,##0.00" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("customers")
      .select("business_name, owner_name, customer_type, municipality_id, dsp_id, status, total_transactions, lifetime_volume_kg, lifetime_amount")
      .is("deleted_at", null);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);
    if (ctx.filters.dspId) query = query.eq("dsp_id", ctx.filters.dspId);
    if (ctx.filters.municipalityId) query = query.eq("municipality_id", ctx.filters.municipalityId);
    if (ctx.filters.customerType) query = query.eq("customer_type", ctx.filters.customerType);

    const [{ data: customers }, { data: dsps }, { data: municipalities }] = await Promise.all([
      query,
      ctx.supabase.from("dsps").select("id, name"),
      ctx.supabase.from("municipalities").select("id, name"),
    ]);
    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));
    const municipalityNameById = new Map((municipalities ?? []).map((m) => [m.id, m.name]));

    const rows = (customers ?? [])
      .map((c) => ({
        name: c.business_name || c.owner_name || "—",
        type: c.customer_type,
        municipality: municipalityNameById.get(c.municipality_id) ?? "—",
        dsp: c.dsp_id ? dspNameById.get(c.dsp_id) ?? "—" : "—",
        status: c.status,
        transactions: c.total_transactions,
        lifetimeVolumeKg: c.lifetime_volume_kg,
        lifetimeAmount: c.lifetime_amount,
      }))
      .sort((a, b) => b.lifetimeAmount - a.lifetimeAmount);

    return { rows, summary: { "Total customers": rows.length } };
  },
};

// ---------------------------------------------------------------------------
// 4. DSP Performance Comparison
// ---------------------------------------------------------------------------
interface DspPerformanceRow {
  dsp: string;
  volumeKg: number;
  revenue: number;
  accounts: number;
  transactions: number;
  repeatRate: number;
}

const dspPerformanceComparison: ReportDefinition<DspPerformanceRow> = {
  key: "dsp-performance-comparison",
  label: "DSP Performance Comparison",
  description: "Volume, revenue, and accounts reached, side by side by DSP.",
  columns: [
    { key: "dsp", header: "DSP", value: (r) => r.dsp },
    { key: "volumeKg", header: "Volume (kg)", value: (r) => r.volumeKg.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "revenue", header: "Revenue", value: (r) => r.revenue.toFixed(2), align: "right", numFmt: "₱#,##0.00" },
    { key: "accounts", header: "Accounts", value: (r) => r.accounts, align: "right" },
    { key: "transactions", header: "Transactions", value: (r) => r.transactions, align: "right" },
    { key: "repeatRate", header: "Repeat rate", value: (r) => `${(r.repeatRate * 100).toFixed(1)}%`, align: "right" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("sales")
      .select("dsp_id, customer_id, customer_type, total_volume_kg, total_amount, is_repeat_purchase")
      .gte("sale_date", ctx.filters.from)
      .lte("sale_date", ctx.filters.to)
      .is("deleted_at", null);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);

    const [{ data: sales }, { data: dsps }] = await Promise.all([
      query,
      ctx.supabase.from("dsps").select("id, name").eq("active", true),
    ]);

    interface Agg { volumeKg: number; revenue: number; accounts: Set<string>; transactions: number; repeat: number }
    const aggByDsp = new Map<string, Agg>();
    for (const d of dsps ?? []) aggByDsp.set(d.id, { volumeKg: 0, revenue: 0, accounts: new Set(), transactions: 0, repeat: 0 });

    for (const s of sales ?? []) {
      const a = aggByDsp.get(s.dsp_id);
      if (!a) continue;
      a.volumeKg += s.total_volume_kg;
      a.revenue += s.total_amount;
      a.transactions += 1;
      if (s.customer_type !== "HH") a.accounts.add(s.customer_id);
      if (s.is_repeat_purchase) a.repeat += 1;
    }

    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));
    const rows = [...aggByDsp.entries()]
      .map(([dspId, a]) => ({
        dsp: dspNameById.get(dspId) ?? "—",
        volumeKg: a.volumeKg,
        revenue: a.revenue,
        accounts: a.accounts.size,
        transactions: a.transactions,
        repeatRate: a.transactions > 0 ? a.repeat / a.transactions : 0,
      }))
      .sort((a, b) => b.volumeKg - a.volumeKg);

    return { rows };
  },
};

// ---------------------------------------------------------------------------
// 5. Municipality Performance Ranking
// ---------------------------------------------------------------------------
interface MunicipalityRow {
  municipality: string;
  volumeKg: number;
  revenue: number;
}

const municipalityPerformanceRanking: ReportDefinition<MunicipalityRow> = {
  key: "municipality-performance-ranking",
  label: "Municipality Performance Ranking",
  description: "All 17 municipalities ranked by volume.",
  columns: [
    { key: "municipality", header: "Municipality", value: (r) => r.municipality },
    { key: "volumeKg", header: "Volume (kg)", value: (r) => r.volumeKg.toFixed(3), align: "right", numFmt: "#,##0.000" },
    { key: "revenue", header: "Revenue", value: (r) => r.revenue.toFixed(2), align: "right", numFmt: "₱#,##0.00" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("sales")
      .select("municipality_id, total_volume_kg, total_amount, dsp_id")
      .gte("sale_date", ctx.filters.from)
      .lte("sale_date", ctx.filters.to)
      .is("deleted_at", null);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);

    const [{ data: sales }, { data: municipalities }] = await Promise.all([
      query,
      ctx.supabase.from("municipalities").select("id, name").eq("active", true),
    ]);

    const agg = new Map<string, { volumeKg: number; revenue: number }>();
    for (const m of municipalities ?? []) agg.set(m.id, { volumeKg: 0, revenue: 0 });
    for (const s of sales ?? []) {
      const a = agg.get(s.municipality_id);
      if (!a) continue;
      a.volumeKg += s.total_volume_kg;
      a.revenue += s.total_amount;
    }

    const municipalityNameById = new Map((municipalities ?? []).map((m) => [m.id, m.name]));
    const rows = [...agg.entries()]
      .map(([id, a]) => ({ municipality: municipalityNameById.get(id) ?? "—", ...a }))
      .sort((a, b) => b.volumeKg - a.volumeKg);

    return { rows };
  },
};

// ---------------------------------------------------------------------------
// 6. Inventory Movement Ledger (DSP-side + warehouse-side, unioned)
// ---------------------------------------------------------------------------
interface InventoryLedgerRow {
  date: string;
  location: string;
  item: string;
  direction: string;
  movementType: string;
  quantity: number;
}

const inventoryMovementLedger: ReportDefinition<InventoryLedgerRow> = {
  key: "inventory-movement-ledger",
  label: "Inventory Movement Ledger",
  description: "Every stock movement, DSP and warehouse side, in one ledger.",
  columns: [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "location", header: "Location", value: (r) => r.location },
    { key: "item", header: "Item", value: (r) => r.item },
    { key: "direction", header: "Direction", value: (r) => r.direction },
    { key: "movementType", header: "Type", value: (r) => r.movementType },
    { key: "quantity", header: "Quantity", value: (r) => r.quantity, align: "right" },
  ],
  async fetch(ctx) {
    let dspQuery = ctx.supabase
      .from("dsp_stock_movements")
      .select("movement_date, dsp_id, item_id, direction, movement_type, quantity")
      .gte("movement_date", ctx.filters.from)
      .lte("movement_date", ctx.filters.to);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) dspQuery = dspQuery.eq("dsp_id", ctx.scope.dspId);

    // Warehouse-side movements aren't attributable to a single DSP (most are
    // restocks/adjustments at the warehouse itself) — a DSP's "own" export
    // only includes the subset addressed to them.
    let warehouseQuery = ctx.supabase
      .from("stock_movements")
      .select("movement_date, destination_dsp_id, item_id, direction, movement_type, quantity")
      .gte("movement_date", ctx.filters.from)
      .lte("movement_date", ctx.filters.to);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) {
      warehouseQuery = warehouseQuery.eq("destination_dsp_id", ctx.scope.dspId);
    }

    const [{ data: dspMoves }, { data: whMoves }, { data: items }, { data: dsps }] = await Promise.all([
      dspQuery,
      warehouseQuery,
      ctx.supabase.from("inventory_items").select("id, name"),
      ctx.supabase.from("dsps").select("id, name"),
    ]);

    const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));
    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

    const rows: InventoryLedgerRow[] = [
      ...(dspMoves ?? []).map((m) => ({
        date: m.movement_date,
        location: dspNameById.get(m.dsp_id) ?? "—",
        item: itemNameById.get(m.item_id) ?? "—",
        direction: m.direction,
        movementType: m.movement_type,
        quantity: m.quantity,
      })),
      ...(whMoves ?? []).map((m) => ({
        date: m.movement_date,
        location: m.destination_dsp_id ? `Warehouse → ${dspNameById.get(m.destination_dsp_id) ?? "—"}` : "Warehouse",
        item: itemNameById.get(m.item_id) ?? "—",
        direction: m.direction,
        movementType: m.movement_type,
        quantity: m.quantity,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return { rows };
  },
};

// ---------------------------------------------------------------------------
// 7. Truck Report Summary
// ---------------------------------------------------------------------------
interface TruckReportRow {
  date: string;
  truckPlate: string;
  dsp: string;
  cratesOut: number;
  cratesReturned: number;
  fuelCost: number;
}

const truckReportSummary: ReportDefinition<TruckReportRow> = {
  key: "truck-report-summary",
  label: "Truck Report Summary",
  description: "Every logged truck run with crates and fuel cost.",
  columns: [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "truckPlate", header: "Plate", value: (r) => r.truckPlate },
    { key: "dsp", header: "DSP", value: (r) => r.dsp },
    { key: "cratesOut", header: "Crates out", value: (r) => r.cratesOut, align: "right" },
    { key: "cratesReturned", header: "Crates returned", value: (r) => r.cratesReturned, align: "right" },
    { key: "fuelCost", header: "Fuel cost", value: (r) => r.fuelCost.toFixed(2), align: "right", numFmt: "₱#,##0.00" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("truck_reports")
      .select("report_date, truck_plate, dsp_id, crates_out, crates_returned, fuel_cost")
      .gte("report_date", ctx.filters.from)
      .lte("report_date", ctx.filters.to);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("dsp_id", ctx.scope.dspId);

    const [{ data: reports }, { data: dsps }] = await Promise.all([
      query,
      ctx.supabase.from("dsps").select("id, name"),
    ]);
    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

    const rows = (reports ?? [])
      .map((r) => ({
        date: r.report_date,
        truckPlate: r.truck_plate ?? "—",
        dsp: r.dsp_id ? dspNameById.get(r.dsp_id) ?? "—" : "—",
        cratesOut: r.crates_out,
        cratesReturned: r.crates_returned,
        fuelCost: r.fuel_cost,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      rows,
      summary: { "Total fuel cost": `₱${rows.reduce((s, r) => s + r.fuelCost, 0).toFixed(2)}` },
    };
  },
};

// ---------------------------------------------------------------------------
// 8. Collateral Allocation by DSP
// ---------------------------------------------------------------------------
interface CollateralAllocationRow {
  dsp: string;
  item: string;
  quantityOut: number;
}

const collateralAllocationByDsp: ReportDefinition<CollateralAllocationRow> = {
  key: "collateral-allocation-by-dsp",
  label: "Collateral Allocation by DSP",
  description: "Marketing collateral handed out, totalled by DSP and item.",
  columns: [
    { key: "dsp", header: "DSP", value: (r) => r.dsp },
    { key: "item", header: "Item", value: (r) => r.item },
    { key: "quantityOut", header: "Quantity", value: (r) => r.quantityOut, align: "right" },
  ],
  async fetch(ctx) {
    let query = ctx.supabase
      .from("collateral_movements")
      .select("assigned_to_dsp_id, item_id, quantity, direction, movement_date")
      .eq("direction", "out")
      .gte("movement_date", ctx.filters.from)
      .lte("movement_date", ctx.filters.to)
      .not("assigned_to_dsp_id", "is", null);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) query = query.eq("assigned_to_dsp_id", ctx.scope.dspId);

    const [{ data: moves }, { data: dsps }, { data: items }] = await Promise.all([
      query,
      ctx.supabase.from("dsps").select("id, name"),
      ctx.supabase.from("collateral_items").select("id, name"),
    ]);
    const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));
    const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));

    const agg = new Map<string, CollateralAllocationRow>();
    for (const m of moves ?? []) {
      if (!m.assigned_to_dsp_id) continue;
      const key = `${m.assigned_to_dsp_id}__${m.item_id}`;
      const row = agg.get(key) ?? {
        dsp: dspNameById.get(m.assigned_to_dsp_id) ?? "—",
        item: itemNameById.get(m.item_id) ?? "—",
        quantityOut: 0,
      };
      row.quantityOut += m.quantity;
      agg.set(key, row);
    }

    const rows = [...agg.values()].sort((a, b) => a.dsp.localeCompare(b.dsp) || a.item.localeCompare(b.item));
    return { rows };
  },
};

// ---------------------------------------------------------------------------
// 9. Activity & Task Completion Report
// ---------------------------------------------------------------------------
interface ActivityTaskRow {
  user: string;
  assigned: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

const activityTaskCompletionReport: ReportDefinition<ActivityTaskRow> = {
  key: "activity-task-completion-report",
  label: "Activity & Task Completion Report",
  description: "Tasks assigned, completed, and overdue, by user.",
  columns: [
    { key: "user", header: "User", value: (r) => r.user },
    { key: "assigned", header: "Assigned", value: (r) => r.assigned, align: "right" },
    { key: "completed", header: "Completed", value: (r) => r.completed, align: "right" },
    { key: "overdue", header: "Overdue", value: (r) => r.overdue, align: "right" },
    { key: "completionRate", header: "Completion rate", value: (r) => `${(r.completionRate * 100).toFixed(1)}%`, align: "right" },
  ],
  async fetch(ctx) {
    const today = new Date().toISOString().slice(0, 10);
    let profileQuery = ctx.supabase.from("profiles").select("id, full_name, dsp_id").eq("active", true);
    if (ctx.scope.scope === "own" && ctx.scope.dspId) profileQuery = profileQuery.eq("dsp_id", ctx.scope.dspId);

    const [{ data: profiles }, { data: tasks }] = await Promise.all([
      profileQuery,
      ctx.supabase
        .from("tasks")
        .select("assigned_to, status, due_date, created_at")
        .gte("created_at", ctx.filters.from)
        .lte("created_at", `${ctx.filters.to}T23:59:59`),
    ]);

    const visibleIds = new Set((profiles ?? []).map((p) => p.id));
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    interface Agg { assigned: number; completed: number; overdue: number }
    const aggByUser = new Map<string, Agg>();
    for (const t of tasks ?? []) {
      if (!visibleIds.has(t.assigned_to)) continue;
      const a = aggByUser.get(t.assigned_to) ?? { assigned: 0, completed: 0, overdue: 0 };
      a.assigned += 1;
      if (t.status === "completed") a.completed += 1;
      if ((t.status === "pending" || t.status === "in_progress") && t.due_date && t.due_date < today) a.overdue += 1;
      aggByUser.set(t.assigned_to, a);
    }

    const rows = [...aggByUser.entries()]
      .map(([userId, a]) => ({
        user: nameById.get(userId) ?? "—",
        assigned: a.assigned,
        completed: a.completed,
        overdue: a.overdue,
        completionRate: a.assigned > 0 ? a.completed / a.assigned : 0,
      }))
      .sort((a, b) => b.assigned - a.assigned);

    return { rows };
  },
};

export const REPORTS: ReportDefinition<Record<string, unknown>>[] = [
  dailySalesSummary,
  monthlyVolumeVsKpi,
  customerMasterList,
  dspPerformanceComparison,
  municipalityPerformanceRanking,
  inventoryMovementLedger,
  truckReportSummary,
  collateralAllocationByDsp,
  activityTaskCompletionReport,
] as unknown as ReportDefinition<Record<string, unknown>>[];

export function getReportByKey(key: string): ReportDefinition<Record<string, unknown>> | undefined {
  return REPORTS.find((r) => r.key === key);
}
