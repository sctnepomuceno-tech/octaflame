"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { saleFormSchema, type SaleFormInput } from "@/lib/validation/sales";

export interface CreateSaleResult {
  error?: string;
  saleId?: string;
  wasDuplicate?: boolean;
}

export async function createSale(input: SaleFormInput): Promise<CreateSaleResult> {
  await requirePermission("sales.create");

  const parsed = saleFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("create_sale", {
    p_client_ref: data.clientRef,
    p_customer_id: data.customerId,
    p_sale_date: data.saleDate,
    p_deployment_date: data.deploymentDate || null,
    p_payment_status: data.paymentStatus,
    p_amount_paid: data.amountPaid,
    p_empties_collected: data.emptiesCollected,
    p_crates_returned_by_customer: data.cratesReturnedByCustomer,
    p_notes: data.notes || null,
    p_items: data.lines.map((l) => ({
      product_id: l.productId,
      qty_crates: l.qtyCrates,
      qty_canisters: l.qtyCanisters,
      qty_sets: l.qtySets,
      notes: l.notes,
    })),
  });

  if (error || !result || result.length === 0) {
    return { error: error?.message ?? "Failed to save the sale." };
  }

  revalidatePath("/sales");
  return { saleId: result[0].sale_id, wasDuplicate: result[0].was_duplicate };
}

/** Soft, non-blocking duplicate warning (§7.9 #5). */
export async function checkRecentSimilarSales(customerId: string, totalAmount: number) {
  await requirePermission("sales.create");
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_recent_similar_sales", {
    p_customer_id: customerId,
    p_total_amount: totalAmount,
  });
  return data ?? [];
}

export interface CustomerSearchResult {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  customer_type: "HH" | "RTL" | "WS";
  municipality_id: string;
  latest_purchase_date: string | null;
}

export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  await requirePermission("sales.create");
  const supabase = await createClient();

  let q = supabase
    .from("customers")
    .select("id, business_name, owner_name, customer_type, municipality_id, latest_purchase_date")
    .order("latest_purchase_date", { ascending: false, nullsFirst: false })
    .limit(10);

  if (query.trim()) {
    q = q.or(`business_name.ilike.%${query}%,owner_name.ilike.%${query}%`);
  }

  const { data } = await q;
  return data ?? [];
}

export interface CustomerSalesContext {
  totalTransactions: number;
  isRepeatCustomer: boolean;
  latestPurchaseDate: string | null;
  lifetimeCanisters: number;
  emptiesOwed: number;
}

/** Repeat-customer chip + empties-owed chip context (§9.2). */
export async function getCustomerSalesContext(
  customerId: string
): Promise<CustomerSalesContext | null> {
  await requirePermission("sales.create");
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("total_transactions, is_repeat_customer, latest_purchase_date, lifetime_canisters")
    .eq("id", customerId)
    .single();

  if (!customer) return null;

  const { data: sales } = await supabase
    .from("sales")
    .select("empties_variance")
    .eq("customer_id", customerId)
    .order("sale_date", { ascending: false })
    .limit(20);

  const emptiesOwed = (sales ?? []).reduce(
    (sum, s) => sum + Math.max(s.empties_variance, 0),
    0
  );

  return {
    totalTransactions: customer.total_transactions,
    isRepeatCustomer: customer.is_repeat_customer,
    latestPurchaseDate: customer.latest_purchase_date,
    lifetimeCanisters: customer.lifetime_canisters,
    emptiesOwed,
  };
}
