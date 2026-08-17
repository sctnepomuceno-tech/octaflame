import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getVolumeConstants } from "@/lib/volume";
import { SalesEntryForm } from "@/components/sales-entry-form";

export const metadata: Metadata = { title: "New sale" };

export default async function NewSalePage() {
  const profile = await requirePermission("sales.create");
  const supabase = await createClient();

  const [{ data: products }, { data: municipalities }, volumeConstants] = await Promise.all([
    supabase
      .from("products")
      .select("id, code, name, unit_price, unit_type, canisters_included")
      .eq("active", true)
      .order("sort_order"),
    supabase.from("municipalities").select("id, name, dsp_id").eq("active", true).order("name"),
    getVolumeConstants(),
  ]);

  const defaultMunicipalityId =
    profile.role === "dsp"
      ? (municipalities ?? []).find((m) => m.dsp_id === profile.dsp_id)?.id
      : undefined;

  return (
    <SalesEntryForm
      products={products ?? []}
      municipalities={municipalities ?? []}
      volumeConstants={volumeConstants}
      defaultMunicipalityId={defaultMunicipalityId}
    />
  );
}
