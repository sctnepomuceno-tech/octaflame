import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getVolumeConstants } from "@/lib/volume";
import { RouteModeForm } from "@/components/route-mode-form";

export const metadata: Metadata = { title: "Route mode" };

export default async function RouteModePage() {
  const profile = await requirePermission("sales.create");
  const supabase = await createClient();

  const [{ data: products }, { data: municipalities }, volumeConstants, { data: offlineCustomers }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, code, name, unit_price, unit_type, canisters_included")
        .eq("active", true)
        .order("sort_order"),
      supabase.from("municipalities").select("id, name, dsp_id").eq("active", true).order("name"),
      getVolumeConstants(),
      supabase
        .from("customers")
        .select("id, business_name, owner_name, customer_type, municipality_id")
        .order("latest_purchase_date", { ascending: false, nullsFirst: false })
        .limit(500),
    ]);

  const defaultMunicipalityId =
    profile.role === "dsp"
      ? (municipalities ?? []).find((m) => m.dsp_id === profile.dsp_id)?.id
      : undefined;

  return (
    <RouteModeForm
      products={products ?? []}
      municipalities={municipalities ?? []}
      volumeConstants={volumeConstants}
      defaultMunicipalityId={defaultMunicipalityId}
      offlineCustomers={offlineCustomers ?? []}
    />
  );
}
