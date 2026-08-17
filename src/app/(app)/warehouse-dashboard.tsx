import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { todayDateString } from "@/lib/dates";
import { formatCount } from "@/lib/volume/format";
import { WAREHOUSE_HOLDER_ID } from "@/lib/warehouse";
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
import { WarehouseStockDialog } from "./warehouse-stock-dialog";

export async function WarehouseDashboard() {
  const supabase = await createClient();
  const today = todayDateString();

  const [
    { data: items },
    { data: balances },
    { data: todayIn },
    { data: todayOut },
    { data: dsps },
    { data: dspBalances },
    { data: pendingIssuances },
    { data: recentTruckReports },
    { data: warehouseEmpties },
    { data: dspEmpties },
    { data: customerEmpties },
  ] = await Promise.all([
    supabase.from("inventory_items").select("id, name, category, reorder_level").eq("active", true),
    supabase.from("warehouse_stock_balance").select("item_id, balance"),
    supabase.from("stock_movements").select("item_id, quantity").eq("movement_date", today).eq("direction", "in"),
    supabase.from("stock_movements").select("item_id, quantity").eq("movement_date", today).eq("direction", "out"),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
    supabase.from("dsp_stock_balance").select("dsp_id, item_id, balance"),
    supabase
      .from("stock_issuances")
      .select("id, issuance_no, dsp_id, created_at")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("truck_reports")
      .select("id, report_date, truck_plate, driver_name, dsp_id")
      .order("report_date", { ascending: false })
      .limit(5),
    supabase.from("warehouse_empties_balance").select("item_type, balance").eq("warehouse_id", WAREHOUSE_HOLDER_ID),
    supabase.from("dsp_empties_balance").select("dsp_id, item_type, balance"),
    supabase.from("customer_empties_balance").select("item_type, balance"),
  ]);

  const balanceByItem = new Map((balances ?? []).map((b) => [b.item_id, b.balance]));
  const dspName = (id: string) => (dsps ?? []).find((d) => d.id === id)?.name ?? "—";

  const canisterId = (items ?? []).find((i) => i.name === "Canister (Full)")?.id;
  const crateId = (items ?? []).find((i) => i.name === "Crate")?.id;
  const stoveIds = new Set((items ?? []).filter((i) => i.category === "stove").map((i) => i.id));
  const stoveTotal = [...stoveIds].reduce((sum, id) => sum + (balanceByItem.get(id) ?? 0), 0);

  const inByItem = new Map<string, number>();
  for (const m of todayIn ?? []) inByItem.set(m.item_id, (inByItem.get(m.item_id) ?? 0) + m.quantity);
  const outByItem = new Map<string, number>();
  for (const m of todayOut ?? []) outByItem.set(m.item_id, (outByItem.get(m.item_id) ?? 0) + m.quantity);
  const totalIn = [...inByItem.values()].reduce((a, b) => a + b, 0);
  const totalOut = [...outByItem.values()].reduce((a, b) => a + b, 0);

  const belowReorder = (items ?? []).filter((i) => (balanceByItem.get(i.id) ?? 0) < i.reorder_level);

  const dspStockRows = (dsps ?? []).map((dsp) => {
    const row: Record<string, number> = {};
    for (const b of dspBalances ?? []) {
      if (b.dsp_id === dsp.id) row[b.item_id] = b.balance;
    }
    return { dsp, row };
  });

  const dspEmptiesTotal = (dspEmpties ?? [])
    .filter((e) => e.item_type === "canister_shell")
    .reduce((sum, e) => sum + e.balance, 0);
  const customerEmptiesTotal = (customerEmpties ?? [])
    .filter((e) => e.item_type === "canister_shell")
    .reduce((sum, e) => sum + Math.max(e.balance, 0), 0);
  const warehouseShells = (warehouseEmpties ?? []).find((e) => e.item_type === "canister_shell")?.balance ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Warehouse</h1>
          <p className="text-sm text-muted-foreground">Depot stock and movements</p>
        </div>
        <WarehouseStockDialog items={items ?? []} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Crates</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCount(crateId ? balanceByItem.get(crateId) ?? 0 : 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Canisters (Full)</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCount(canisterId ? balanceByItem.get(canisterId) ?? 0 : 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">Stoves</div>
            <div className="text-2xl font-semibold tabular-nums">{formatCount(stoveTotal)}</div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="text-xs text-muted-foreground">In / Out today</div>
            <div className="text-2xl font-semibold tabular-nums">
              +{formatCount(totalIn)} / -{formatCount(totalOut)}
            </div>
          </CardContent>
        </Card>
      </div>

      {belowReorder.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {belowReorder.map((i) => (
            <Badge key={i.id} variant="warning">
              ⚠ {i.name} low: {formatCount(balanceByItem.get(i.id) ?? 0)} (reorder at {i.reorder_level})
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Stock out with DSPs</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DSP</TableHead>
              <TableHead className="text-right">Crates</TableHead>
              <TableHead className="text-right">Canisters</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dspStockRows.map(({ dsp, row }) => (
              <TableRow key={dsp.id}>
                <TableCell className="font-medium">{dsp.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(crateId ? row[crateId] ?? 0 : 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(canisterId ? row[canisterId] ?? 0 : 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empties position</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Held at warehouse</span>
              <span className="tabular-nums font-medium">{formatCount(warehouseShells)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Held by DSPs</span>
              <span className="tabular-nums font-medium">{formatCount(dspEmptiesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owed by customers</span>
              <span className="tabular-nums font-medium">{formatCount(customerEmptiesTotal)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Ready to return to plant</span>
              <span className="tabular-nums">{formatCount(warehouseShells)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending acknowledgements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(pendingIssuances ?? []).map((issuance) => (
              <Link
                key={issuance.id}
                href="/stock/issuances"
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent"
              >
                <span>
                  {issuance.issuance_no} · {dspName(issuance.dsp_id)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(issuance.created_at), { addSuffix: true })}
                </span>
              </Link>
            ))}
            {(pendingIssuances ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nothing pending.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Recent truck reports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-6">
          {(recentTruckReports ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                {t.report_date} · {t.truck_plate ?? "—"} · {t.driver_name ?? "—"}
              </span>
              <span className="text-muted-foreground">{dspName(t.dsp_id ?? "")}</span>
            </div>
          ))}
          {(recentTruckReports ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No truck reports yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
