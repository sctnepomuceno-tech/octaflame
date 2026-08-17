import { redirect } from "next/navigation";

import type { Profile } from "@/lib/auth/current-user";
import { profileHasPermission } from "@/lib/permissions";

export interface ExportScope {
  /** "all" sees every DSP's rows; "own" is restricted to their own dsp_id. */
  scope: "all" | "own";
  dspId: string | null;
}

/**
 * Every export respects the requester's data scope — a DSP exporting gets
 * only their own rows, always (§11). Call this after requiring reports.read.*
 * to find out whether the caller may see company-wide data or just their own.
 */
export function getExportScope(profile: Profile): ExportScope {
  if (profileHasPermission(profile, "export.all") || profileHasPermission(profile, "reports.read.all")) {
    return { scope: "all", dspId: null };
  }
  if (profileHasPermission(profile, "export.own") || profileHasPermission(profile, "reports.read.own")) {
    return { scope: "own", dspId: profile.dsp_id };
  }
  redirect("/");
}
