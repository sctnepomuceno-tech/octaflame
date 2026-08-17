"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { productFormSchema, type ProductFormInput } from "@/lib/validation/products";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function createProduct(input: ProductFormInput): Promise<ActionResult> {
  await requirePermission("products.manage");

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("products").insert({
    code: data.code,
    name: data.name,
    unit_price: data.unitPrice,
    unit_type: data.unitType,
    canisters_included: data.canistersIncluded,
    includes_stove: data.includesStove,
    stove_count: data.stoveCount,
    sort_order: data.sortOrder,
  });

  if (error) {
    if (error.message.includes("products_code_key")) {
      return { error: "A product with this code already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/products");
  return { success: true };
}

// Price changes flow through the same update — the products_track_price_change
// trigger (Phase 6 migration) writes the price_history row automatically, so
// this action never touches price_history directly.
export async function updateProduct(productId: string, input: ProductFormInput): Promise<ActionResult> {
  await requirePermission("products.manage");

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({
      code: data.code,
      name: data.name,
      unit_price: data.unitPrice,
      unit_type: data.unitType,
      canisters_included: data.canistersIncluded,
      includes_stove: data.includesStove,
      stove_count: data.stoveCount,
      sort_order: data.sortOrder,
    })
    .eq("id", productId);

  if (error) {
    if (error.message.includes("products_code_key")) {
      return { error: "A product with this code already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/products");
  return { success: true };
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  const supabase = await createClient();

  const { error } = await supabase.from("products").update({ active }).eq("id", productId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/products");
  return { success: true };
}
