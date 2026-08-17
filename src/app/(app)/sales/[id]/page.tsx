import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAnyPermission, profileHasPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReceiptView } from "@/components/receipt-view";
import { SaleReturnsPanel } from "@/components/sale-returns-panel";

export const metadata: Metadata = { title: "Sale" };

export default async function SaleDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireAnyPermission(["sales.read.own", "sales.read.all"]);
  const { id } = await props.params;

  const supabase = await createClient();

  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).single();
  if (!sale) {
    notFound();
  }

  const [{ data: items }, { data: customer }, { data: dsp }, { data: municipality }, { data: returns }] =
    await Promise.all([
      supabase
        .from("sale_items")
        .select("id, qty_crates, qty_canisters, qty_sets, unit_price, line_total, line_canisters, line_volume_kg, notes, product_id")
        .eq("sale_id", id),
      supabase
        .from("customers")
        .select("business_name, owner_name, contact_number, address")
        .eq("id", sale.customer_id)
        .single(),
      supabase.from("dsps").select("name").eq("id", sale.dsp_id).single(),
      supabase.from("municipalities").select("name").eq("id", sale.municipality_id).single(),
      supabase.from("sale_returns").select("sale_item_id, quantity").eq("sale_id", id),
    ]);

  const productIds = (items ?? []).map((i) => i.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, code")
    .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const returnedByItemId = new Map<string, number>();
  for (const r of returns ?? []) {
    returnedByItemId.set(r.sale_item_id, (returnedByItemId.get(r.sale_item_id) ?? 0) + r.quantity);
  }

  const canReturn =
    profileHasPermission(profile, "sales.edit.own") || profileHasPermission(profile, "sales.edit.all");

  return (
    <div className="flex flex-col gap-4">
      <ReceiptView
        sale={sale}
        items={(items ?? []).map((i) => ({
          ...i,
          productName: productById.get(i.product_id)?.name ?? "Item",
        }))}
        customerName={customer?.business_name || customer?.owner_name || "Customer"}
        customerAddress={customer?.address ?? null}
        customerContact={customer?.contact_number ?? null}
        dspName={dsp?.name ?? "—"}
        municipalityName={municipality?.name ?? "—"}
      />
      <div className="mx-auto w-full max-w-2xl px-6 pb-6">
        <SaleReturnsPanel
          saleId={id}
          canReturn={canReturn}
          items={(items ?? []).map((i) => ({
            id: i.id,
            productName: productById.get(i.product_id)?.name ?? "Item",
            line_canisters: i.line_canisters,
            line_total: i.line_total,
            returned: returnedByItemId.get(i.id) ?? 0,
          }))}
        />
      </div>
    </div>
  );
}
