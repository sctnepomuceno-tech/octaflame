"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function updateNotificationRule(
  ruleKey: string,
  input: { enabled?: boolean; threshold?: number | null }
): Promise<ActionResult> {
  await requirePermission("notifications.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_rules")
    .update({
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
    })
    .eq("rule_key", ruleKey);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/notifications");
  return { success: true };
}
