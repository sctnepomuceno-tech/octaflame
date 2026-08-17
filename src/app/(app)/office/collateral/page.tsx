import type { Metadata } from "next";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/volume";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollateralMovementDialog } from "./collateral-movement-dialog";

export const metadata: Metadata = { title: "Collateral" };

export default async function CollateralPage() {
  await requireAnyPermission(["office.read", "office.create"]);
  const supabase = await createClient();

  const [{ data: items }, { data: balances }, { data: dsps }, { data: recent }] = await Promise.all([
    supabase.from("collateral_items").select("id, name, category, reorder_level").eq("active", true).order("name"),
    supabase.from("collateral_balance").select("item_id, balance"),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
    supabase
      .from("collateral_movements")
      .select("id, item_id, movement_type, quantity, movement_date, assigned_to_dsp_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const balanceByItem = new Map((balances ?? []).map((b) => [b.item_id, b.balance]));
  const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collateral</h1>
          <p className="text-sm text-muted-foreground">Marketing materials inventory ledger</p>
        </div>
        <CollateralMovementDialog items={items ?? []} dsps={dsps ?? []} />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">On hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((i) => {
              const balance = balanceByItem.get(i.id) ?? 0;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{i.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(balance)}
                    {balance < i.reorder_level ? (
                      <Badge variant="warning" className="ml-2 text-[10px]">
                        low
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>DSP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(recent ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.movement_date}</TableCell>
                <TableCell>{itemNameById.get(m.item_id) ?? "Item"}</TableCell>
                <TableCell className="capitalize">{m.movement_type}</TableCell>
                <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.assigned_to_dsp_id ? dspNameById.get(m.assigned_to_dsp_id) ?? "—" : "—"}
                </TableCell>
              </TableRow>
            ))}
            {(recent ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No movements yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
