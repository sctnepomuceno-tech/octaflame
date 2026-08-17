"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function recordCollateralMovement(input: {
  itemId: string;
  quantity: number;
  direction: "in" | "out";
  movementType: "in" | "out" | "adjustment" | "return";
  assignedToDspId?: string;
  reason?: string;
  remarks?: string;
}): Promise<ActionResult> {
  const profile = await requireAnyPermission(["office.create", "office.adjust"]);
  if (input.movementType === "adjustment" && !input.reason) {
    return { error: "Adjustments require a reason." };
  }
  const supabase = await createClient();

  const { error } = await supabase.from("collateral_movements").insert({
    item_id: input.itemId,
    movement_type: input.movementType,
    quantity: input.quantity,
    direction: input.direction,
    assigned_to_dsp_id: input.assignedToDspId || null,
    reason: input.reason || null,
    remarks: input.remarks || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/office/collateral");
  revalidatePath("/");
  return { success: true };
}
