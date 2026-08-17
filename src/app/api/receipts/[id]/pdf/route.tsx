import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReceiptDocument } from "@/lib/pdf/receipt-document";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAnyPermission(["sales.read.own", "sales.read.all"]);
  const { id } = await params;

  const supabase = await createClient();

  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).single();
  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: items }, { data: customer }, { data: dsp }, { data: municipality }] =
    await Promise.all([
      supabase
        .from("sale_items")
        .select("id, qty_crates, qty_canisters, qty_sets, unit_price, line_total, notes, product_id")
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
    .select("id, name")
    .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const buffer = await renderToBuffer(
    <ReceiptDocument
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sale.receipt_no}.pdf"`,
    },
  });
}
