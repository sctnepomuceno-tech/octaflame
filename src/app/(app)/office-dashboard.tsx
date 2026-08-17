import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { todayDateString } from "@/lib/dates";
import { formatCount } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function OfficeDashboard() {
  const supabase = await createClient();
  const today = todayDateString();
  const year = new Date().getFullYear();

  const [{ data: items }, { data: balances }, { data: todayMoves }, { data: allocations }, { data: dsps }] =
    await Promise.all([
      supabase.from("collateral_items").select("id, name, category, reorder_level").eq("active", true),
      supabase.from("collateral_balance").select("item_id, balance"),
      supabase.from("collateral_movements").select("item_id, quantity, direction").eq("movement_date", today),
      supabase.from("collateral_dsp_allocation").select("dsp_id, item_id, quantity").eq("year", year),
      supabase.from("dsps").select("id, name").eq("active", true).order("name"),
    ]);

  const balanceByItem = new Map((balances ?? []).map((b) => [b.item_id, b.balance]));
  const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));

  const todayIn = (todayMoves ?? []).filter((m) => m.direction === "in").reduce((s, m) => s + m.quantity, 0);
  const todayOut = (todayMoves ?? []).filter((m) => m.direction === "out").reduce((s, m) => s + m.quantity, 0);

  const belowReorder = (items ?? []).filter((i) => (balanceByItem.get(i.id) ?? 0) < i.reorder_level);

  const mostRequested = [...(todayMoves ?? [])]
    .filter((m) => m.direction === "out")
    .reduce((map, m) => map.set(m.item_id, (map.get(m.item_id) ?? 0) + m.quantity), new Map<string, number>());

  const allocationByDsp = new Map<string, number>();
  for (const a of allocations ?? []) {
    allocationByDsp.set(a.dsp_id, (allocationByDsp.get(a.dsp_id) ?? 0) + a.quantity);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Office</h1>
          <p className="text-sm text-muted-foreground">Marketing collateral inventory</p>
        </div>
        <Button asChild>
          <Link href="/office/collateral">Manage collateral</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(items ?? []).slice(0, 4).map((i) => (
          <Card key={i.id} className="p-4">
            <CardContent className="p-0">
              <div className="text-xs text-muted-foreground">{i.name}</div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatCount(balanceByItem.get(i.id) ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">In today: {formatCount(todayIn)}</Badge>
        <Badge variant="secondary">Out today: {formatCount(todayOut)}</Badge>
        {[...mostRequested.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([itemId, qty]) => (
            <Badge key={itemId} variant="outline">
              Most requested: {itemNameById.get(itemId) ?? "Item"} ({formatCount(qty)})
            </Badge>
          ))}
        {belowReorder.map((i) => (
          <Badge key={i.id} variant="warning">
            ⚠ {i.name} low
          </Badge>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Current inventory</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">On hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell className="text-muted-foreground capitalize">{i.category ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(balanceByItem.get(i.id) ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Allocation by DSP · {year} YTD</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DSP</TableHead>
              <TableHead className="text-right">Total allocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(dsps ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(allocationByDsp.get(d.id) ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
