import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";

import { requireAnyPermission, profileHasPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
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
import { NewIssuanceDialog } from "./new-issuance-dialog";
import { AcknowledgeIssuanceDialog } from "./acknowledge-issuance-dialog";

export const metadata: Metadata = { title: "Stock issuances" };

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  acknowledged: "success",
  disputed: "destructive",
};

export default async function StockIssuancesPage() {
  const profile = await requireAnyPermission(["warehouse.read", "warehouse.create"]);
  const canCreate = profileHasPermission(profile, "warehouse.create");

  const supabase = await createClient();

  const [{ data: issuances }, { data: dsps }, { data: items }, { data: issuanceItems }] =
    await Promise.all([
      supabase
        .from("stock_issuances")
        .select("id, issuance_no, dsp_id, issue_date, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("dsps").select("id, name").eq("active", true).order("name"),
      supabase.from("inventory_items").select("id, name").eq("active", true).order("name"),
      supabase
        .from("stock_issuance_items")
        .select("issuance_id, item_id, quantity_issued"),
    ]);

  const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));
  const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const itemsByIssuance = new Map<string, { itemId: string; itemName: string; quantityIssued: number }[]>();
  for (const ii of issuanceItems ?? []) {
    const list = itemsByIssuance.get(ii.issuance_id) ?? [];
    list.push({ itemId: ii.item_id, itemName: itemNameById.get(ii.item_id) ?? "Item", quantityIssued: ii.quantity_issued });
    itemsByIssuance.set(ii.issuance_id, list);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock issuances</h1>
          <p className="text-sm text-muted-foreground">Warehouse → DSP handovers, with acknowledgement.</p>
        </div>
        {canCreate ? <NewIssuanceDialog dsps={dsps ?? []} items={items ?? []} /> : null}
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issuance</TableHead>
              <TableHead>DSP</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(issuances ?? []).map((issuance) => {
              const items = itemsByIssuance.get(issuance.id) ?? [];
              const isOld =
                issuance.status === "pending" &&
                Date.now() - new Date(issuance.created_at).getTime() > 48 * 60 * 60 * 1000;
              return (
                <TableRow key={issuance.id}>
                  <TableCell className="font-medium">{issuance.issuance_no}</TableCell>
                  <TableCell>{dspNameById.get(issuance.dsp_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{issuance.issue_date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={STATUS_VARIANT[issuance.status]} className="capitalize">
                        {issuance.status}
                      </Badge>
                      {isOld ? (
                        <span className="text-xs text-destructive">
                          {formatDistanceToNow(new Date(issuance.created_at))} old
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {issuance.status === "pending" ? (
                      <AcknowledgeIssuanceDialog
                        issuanceId={issuance.id}
                        issuanceNo={issuance.issuance_no}
                        items={items}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {(issuances ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No issuances yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
