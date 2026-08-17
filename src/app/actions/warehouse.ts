"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function recordWarehouseStockIn(input: {
  itemId: string;
  quantity: number;
  source?: string;
  referenceNo?: string;
  remarks?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["warehouse.create"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_warehouse_stock_in", {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_source: input.source || null,
    p_reference_no: input.referenceNo || null,
    p_remarks: input.remarks || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function recordWarehouseAdjustment(input: {
  itemId: string;
  quantity: number;
  direction: "in" | "out";
  reason: string;
  remarks?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["warehouse.adjust"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_warehouse_adjustment", {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_direction: input.direction,
    p_reason: input.reason,
    p_remarks: input.remarks || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function transferDspToWarehouse(input: {
  dspId: string;
  itemType: "canister_shell" | "crate";
  quantity: number;
  notes?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["warehouse.create", "warehouse.read"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("dsp_to_warehouse_transfer", {
    p_dsp_id: input.dspId,
    p_item_type: input.itemType,
    p_quantity: input.quantity,
    p_notes: input.notes || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function transferWarehouseToPlant(input: {
  itemType: "canister_shell" | "crate";
  quantity: number;
  notes?: string;
}): Promise<ActionResult> {
  await requireAnyPermission(["warehouse.adjust"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("warehouse_to_plant_transfer", {
    p_item_type: input.itemType,
    p_quantity: input.quantity,
    p_notes: input.notes || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}
