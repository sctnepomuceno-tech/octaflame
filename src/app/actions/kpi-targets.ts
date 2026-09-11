"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface KpiTargetRow {
  year: number;
  month: number | null;
  accounts_target: number;
  volume_target_mt: number;
}

/** Company-wide (dsp_id is null) targets for a year: the annual row plus any monthly overrides. */
export async function getKpiTargets(year: number): Promise<KpiTargetRow[]> {
  await requirePermission("settings.manage");
  const supabase = await createClient();

  const { data } = await supabase
    .from("kpi_targets")
    .select("year, month, accounts_target, volume_target_mt")
    .eq("year", year)
    .is("dsp_id", null)
    .order("month", { nullsFirst: true });

  return data ?? [];
}

export async function upsertKpiTarget(input: {
  year: number;
  month: number | null;
  accountsTarget: number;
  volumeTargetMt: number;
}): Promise<ActionResult> {
  const profile = await requirePermission("settings.manage");

  if (input.accountsTarget < 0 || input.volumeTargetMt < 0) {
    return { error: "Targets can't be negative." };
  }
  if (input.month !== null && (input.month < 1 || input.month > 12)) {
    return { error: "Month must be between 1 and 12." };
  }

  const supabase = await createClient();

  // The company-wide uniqueness constraint is a partial/expression index
  // (year, coalesce(month, 0) where dsp_id is null), which PostgREST's
  // upsert onConflict can't target directly — so look the row up first.
  let existing = supabase.from("kpi_targets").select("id").eq("year", input.year).is("dsp_id", null);
  existing = input.month === null ? existing.is("month", null) : existing.eq("month", input.month);
  const { data: existingRow } = await existing.maybeSingle();

  const { error } = existingRow
    ? await supabase
        .from("kpi_targets")
        .update({ accounts_target: input.accountsTarget, volume_target_mt: input.volumeTargetMt })
        .eq("id", existingRow.id)
    : await supabase.from("kpi_targets").insert({
        year: input.year,
        month: input.month,
        dsp_id: null,
        accounts_target: input.accountsTarget,
        volume_target_mt: input.volumeTargetMt,
      });

  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "kpi_target.upserted",
    table_name: "kpi_targets",
    new_value: input,
  });

  revalidatePath("/settings/kpi-targets");
  revalidatePath("/");
  return { success: true };
}

export async function clearMonthlyKpiTarget(year: number, month: number): Promise<ActionResult> {
  const profile = await requirePermission("settings.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("kpi_targets")
    .delete()
    .eq("year", year)
    .eq("month", month)
    .is("dsp_id", null);

  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "kpi_target.monthly_cleared",
    table_name: "kpi_targets",
    new_value: { year, month },
  });

  revalidatePath("/settings/kpi-targets");
  revalidatePath("/");
  return { success: true };
}
