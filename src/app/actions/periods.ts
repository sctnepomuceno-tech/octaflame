"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface PrecheckRow {
  check_name: string;
  item_count: number;
  description: string;
}

export async function getPeriodPrecheck(year: number, month: number): Promise<PrecheckRow[]> {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.rpc("period_close_precheck", { p_year: year, p_month: month });
  return data ?? [];
}

export async function closePeriod(year: number, month: number): Promise<ActionResult> {
  const profile = await requirePermission("settings.manage");
  const supabase = await createClient();

  const { error } = await supabase.rpc("close_accounting_period", { p_year: year, p_month: month });
  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "period.closed",
    table_name: "accounting_periods",
    new_value: { year, month },
  });

  revalidatePath("/settings/periods");
  return { success: true };
}

export async function reopenPeriod(year: number, month: number, reason: string): Promise<ActionResult> {
  const profile = await requirePermission("settings.manage");
  const supabase = await createClient();

  const { error } = await supabase.rpc("reopen_accounting_period", {
    p_year: year,
    p_month: month,
    p_reason: reason,
  });
  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "period.reopened",
    table_name: "accounting_periods",
    new_value: { year, month, reason },
  });

  revalidatePath("/settings/periods");
  return { success: true };
}
