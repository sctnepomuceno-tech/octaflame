"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission, requireProfile } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface IssuanceItemInput {
  itemId: string;
  quantityIssued: number;
  notes?: string;
}

export async function createStockIssuance(
  dspId: string,
  issueDate: string,
  notes: string | undefined,
  items: IssuanceItemInput[]
): Promise<ActionResult> {
  await requireAnyPermission(["warehouse.create"]);
  if (items.length === 0) {
    return { error: "Add at least one item." };
  }
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_stock_issuance", {
    p_dsp_id: dspId,
    p_issue_date: issueDate,
    p_notes: notes || null,
    p_items: items.map((i) => ({
      item_id: i.itemId,
      quantity_issued: i.quantityIssued,
      notes: i.notes,
    })),
  });

  if (error) {
    return { error: error.message };
  }
  revalidatePath("/stock/issuances");
  return { success: true };
}

export interface ReceivedItemInput {
  itemId: string;
  quantityReceived: number;
}

export async function acknowledgeStockIssuance(
  issuanceId: string,
  received: ReceivedItemInput[],
  disputeReason?: string
): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("acknowledge_stock_issuance", {
    p_issuance_id: issuanceId,
    p_received: received.map((r) => ({ item_id: r.itemId, quantity_received: r.quantityReceived })),
    p_dispute_reason: disputeReason || null,
  });

  if (error) {
    return { error: error.message };
  }
  revalidatePath("/stock/issuances");
  return { success: true };
}

export interface DspStockSummary {
  itemName: string;
  category: "crate" | "canister" | "stove" | "other";
  balance: number;
}

export interface EmptiesSummary {
  itemType: "canister_shell" | "crate";
  balance: number;
}

export async function getDspStockSummary(dspId: string) {
  const supabase = await createClient();

  const [{ data: balances }, { data: items }, { data: empties }, { data: pending }, { data: lastCount }] =
    await Promise.all([
      supabase.from("dsp_stock_balance").select("item_id, balance").eq("dsp_id", dspId),
      supabase.from("inventory_items").select("id, name, category"),
      supabase.from("dsp_empties_balance").select("item_type, balance").eq("dsp_id", dspId),
      supabase
        .from("stock_issuances")
        .select("id, issuance_no, issue_date")
        .eq("dsp_id", dspId)
        .eq("status", "pending"),
      supabase
        .from("stock_counts")
        .select("count_date")
        .eq("scope", "dsp")
        .eq("scope_id", dspId)
        .eq("status", "approved")
        .order("count_date", { ascending: false })
        .limit(1),
    ]);

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const stock: DspStockSummary[] = [];
  for (const b of balances ?? []) {
    const item = itemById.get(b.item_id);
    if (item) {
      stock.push({ itemName: item.name, category: item.category, balance: b.balance });
    }
  }

  const emptiesSummary: EmptiesSummary[] = (empties ?? []).map((e) => ({
    itemType: e.item_type,
    balance: e.balance,
  }));

  return {
    stock,
    empties: emptiesSummary,
    pendingIssuances: pending ?? [],
    lastCountDate: lastCount?.[0]?.count_date ?? null,
  };
}
