import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { VolumeConstants } from "./calculations";

/** Fallback values match §3 exactly; only used if `settings` is unreadable. */
const DEFAULT_VOLUME_CONSTANTS: VolumeConstants = {
  canistersPerCrate: 24,
  kgPerCanister: 0.17,
};

/**
 * Loads CANISTERS_PER_CRATE / KG_PER_CANISTER from the `settings` table.
 * Cached per request (React `cache`) so repeated calls within one render
 * don't issue duplicate queries. Server-only — settings are read here, not
 * hard-coded at call sites (§7.1).
 */
export const getVolumeConstants = cache(async (): Promise<VolumeConstants> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["canisters_per_crate", "kg_per_canister"]);

  if (error || !data) {
    return DEFAULT_VOLUME_CONSTANTS;
  }

  const byKey = new Map(data.map((row) => [row.key, row.value]));
  const canistersPerCrate = Number(byKey.get("canisters_per_crate"));
  const kgPerCanister = Number(byKey.get("kg_per_canister"));

  return {
    canistersPerCrate: Number.isFinite(canistersPerCrate)
      ? canistersPerCrate
      : DEFAULT_VOLUME_CONSTANTS.canistersPerCrate,
    kgPerCanister: Number.isFinite(kgPerCanister)
      ? kgPerCanister
      : DEFAULT_VOLUME_CONSTANTS.kgPerCanister,
  };
});
