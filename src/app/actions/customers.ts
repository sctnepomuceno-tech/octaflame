"use server";

import { revalidatePath } from "next/cache";

import { requirePermission, requireAnyPermission, requireProfile } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { customerFormSchema, type CustomerFormInput } from "@/lib/validation/customers";

export interface ActionResult<T = undefined> {
  error?: string;
  success?: boolean;
  data?: T;
}

export interface SimilarCustomer {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  similarity: number;
}

/** Non-blocking fuzzy duplicate warning shown before save (§6.2). */
export async function findSimilarCustomers(
  name: string,
  municipalityId: string
): Promise<SimilarCustomer[]> {
  await requireProfile();
  if (!name.trim() || !municipalityId) {
    return [];
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_similar_customers", {
    p_name: name,
    p_municipality_id: municipalityId,
  });
  return data ?? [];
}

export async function createCustomer(
  input: CustomerFormInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await requirePermission("customers.create");

  const parsed = customerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  if (profile.role === "dsp") {
    const { data: municipality } = await supabase
      .from("municipalities")
      .select("dsp_id")
      .eq("id", data.municipalityId)
      .single();
    if (!municipality || municipality.dsp_id !== profile.dsp_id) {
      return { error: "You can only add customers in your own territory." };
    }
  }

  const { data: inserted, error } = await supabase
    .from("customers")
    .insert({
      business_name: data.businessName || null,
      owner_name: data.ownerName || null,
      contact_number: data.contactNumber || null,
      customer_type: data.customerType,
      municipality_id: data.municipalityId,
      barangay: data.barangay || null,
      address: data.address || null,
      landmark: data.landmark || null,
      notes: data.notes || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create customer." };
  }

  revalidatePath("/customers");
  return { success: true, data: { id: inserted.id } };
}

/**
 * Sync path for a customer created offline (§9.3). Uses the client-
 * generated id as the real, permanent id — idempotent on retry via
 * upsert(id), the same "safe to call twice" discipline as create_sale's
 * client_ref.
 */
export async function syncOfflineCustomer(
  id: string,
  input: CustomerFormInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await requirePermission("customers.create");

  const parsed = customerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  if (profile.role === "dsp") {
    const { data: municipality } = await supabase
      .from("municipalities")
      .select("dsp_id")
      .eq("id", data.municipalityId)
      .single();
    if (!municipality || municipality.dsp_id !== profile.dsp_id) {
      return { error: "You can only add customers in your own territory." };
    }
  }

  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        id,
        business_name: data.businessName || null,
        owner_name: data.ownerName || null,
        contact_number: data.contactNumber || null,
        customer_type: data.customerType,
        municipality_id: data.municipalityId,
        barangay: data.barangay || null,
        address: data.address || null,
        landmark: data.landmark || null,
        notes: data.notes || null,
        created_by: profile.id,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { success: true, data: { id } };
}

export async function updateCustomer(
  id: string,
  input: CustomerFormInput
): Promise<ActionResult> {
  await requireAnyPermission(["customers.edit.own", "customers.edit.all"]);

  const parsed = customerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      business_name: data.businessName || null,
      owner_name: data.ownerName || null,
      contact_number: data.contactNumber || null,
      customer_type: data.customerType,
      municipality_id: data.municipalityId,
      barangay: data.barangay || null,
      address: data.address || null,
      landmark: data.landmark || null,
      notes: data.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}
