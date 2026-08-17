"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Reassigns a municipality to a different DSP (§5.7). Municipalities attach
 * to a DSP record, not a person — this only affects future transactions;
 * historical sales keep their snapshotted dsp_id and are never rewritten.
 */
export async function reassignMunicipality(municipalityId: string, dspId: string): Promise<ActionResult> {
  const profile = await requirePermission("settings.manage");
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("municipalities")
    .select("dsp_id")
    .eq("id", municipalityId)
    .single();

  const { error } = await supabase
    .from("municipalities")
    .update({ dsp_id: dspId })
    .eq("id", municipalityId);

  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "municipality.reassigned",
    table_name: "municipalities",
    record_id: municipalityId,
    previous_value: { dsp_id: before?.dsp_id ?? null },
    new_value: { dsp_id: dspId },
  });

  revalidatePath("/settings/territories");
  return { success: true };
}
