"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function createSaleReturn(input: {
  saleId: string;
  saleItemId: string;
  quantity: number;
  returnType: "damaged" | "leaking" | "wrong_item" | "customer_return" | "expired";
  restockable: boolean;
  refundAmount: number;
  returnDate: string;
  notes?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["sales.edit.own", "sales.edit.all"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_sale_return", {
    p_sale_item_id: input.saleItemId,
    p_quantity: input.quantity,
    p_return_type: input.returnType,
    p_restockable: input.restockable,
    p_refund_amount: input.refundAmount,
    p_return_date: input.returnDate,
    p_notes: input.notes || null,
  });

  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/sales/${input.saleId}`);
  return { success: true };
}

export async function recordEmptiesCollection(input: {
  customerId: string;
  itemType: "canister_shell" | "crate";
  quantity: number;
  notes?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["customers.edit.own", "customers.edit.all"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_empties_collection", {
    p_customer_id: input.customerId,
    p_item_type: input.itemType,
    p_quantity: input.quantity,
    p_notes: input.notes || null,
  });

  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/customers/${input.customerId}`);
  return { success: true };
}
