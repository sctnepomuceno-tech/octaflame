import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductActiveToggle } from "./product-active-toggle";
import { PriceHistoryDialog, type PriceHistoryRow } from "./price-history-dialog";

export const metadata: Metadata = { title: "Products" };

const UNIT_TYPE_LABELS: Record<string, string> = {
  canister: "Canister",
  crate: "Crate",
  set: "Set",
};

export default async function ProductsPage() {
  await requirePermission("products.manage");

  const supabase = await createClient();
  const [{ data: products }, { data: history }, { data: profiles }] = await Promise.all([
    supabase.from("products").select("*").order("sort_order"),
    supabase
      .from("price_history")
      .select("id, product_id, unit_price, effective_from, effective_to, changed_by")
      .order("effective_from", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const nameByProfileId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const historyByProduct = new Map<string, PriceHistoryRow[]>();
  for (const h of history ?? []) {
    const list = historyByProduct.get(h.product_id) ?? [];
    list.push({
      id: h.id,
      unit_price: h.unit_price,
      effective_from: h.effective_from,
      effective_to: h.effective_to,
      changed_by_name: h.changed_by ? nameByProfileId.get(h.changed_by) ?? null : null,
    });
    historyByProduct.set(h.product_id, list);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Price changes are tracked automatically — historical sales keep
            the price they were made at.
          </p>
        </div>
        <ProductFormDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">All products</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                <TableCell className="font-medium">
                  {p.name}
                  {p.includes_stove ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (+{p.stove_count} stove{p.stove_count === 1 ? "" : "s"})
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{UNIT_TYPE_LABELS[p.unit_type]}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.unit_price)}</TableCell>
                <TableCell>
                  {p.active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <PriceHistoryDialog productName={p.name} rows={historyByProduct.get(p.id) ?? []} />
                    <ProductFormDialog product={p} />
                    <ProductActiveToggle productId={p.id} active={p.active} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
