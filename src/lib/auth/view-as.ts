import "server-only";

import { cookies } from "next/headers";

import { ROLES, type Role } from "@/lib/permissions";

/**
 * Lets a Management user preview the app as another role would see it
 * (nav, dashboard) without touching their real account. Read-only display
 * switch, not impersonation: every server action and RLS policy still
 * enforces the real profile's permissions regardless of this cookie
 * (§4.1 #4, §15.2) — previewing "DSP" never actually restricts what a
 * Management user can do, only what the UI shows them.
 */
export const VIEW_AS_COOKIE = "octaflame_view_as";

export async function getViewAsRole(): Promise<Role | null> {
  const store = await cookies();
  const value = store.get(VIEW_AS_COOKIE)?.value;
  if (value && value !== "management" && ROLES.includes(value as Role)) {
    return value as Role;
  }
  return null;
}
