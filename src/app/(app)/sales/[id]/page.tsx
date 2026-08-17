import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReceiptView } from "@/components/receipt-view";

export const metadata: Metadata = { title: "Sale" };

export default async function SaleDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyPermission(["sales.read.own", "sales.read.all"]);
  const { id } = await props.params;

  const supabase = await createClient();

  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).single();
  if (!sale) {
    notFound();
  }

  const [{ data: items }, { data: customer }, { data: dsp }, { data: municipality }] =
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
    ]);

  const productIds = (items ?? []).map((i) => i.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, code")
    .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return (
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
  );
}
