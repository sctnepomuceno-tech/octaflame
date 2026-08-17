import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { profileHasPermission, type PermissionKey } from "@/lib/permissions";

export { profileHasPermission };

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Loads the authenticated user's profile, cached per request. Middleware
 * already redirects unauthenticated / deactivated / must-change-password
 * requests away, but every server component and action re-derives scope
 * from this instead of trusting the client (§4.1 #4, §15.2).
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
});

/** Use in server components that must not render without a session. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) {
    redirect("/login");
  }
  return profile;
}

/** Use in a server component/action to enforce a permission, all three layers (§15.2). */
export async function requirePermission(
  permission: PermissionKey
): Promise<Profile> {
  const profile = await requireProfile();
  if (!profileHasPermission(profile, permission)) {
    redirect("/");
  }
  return profile;
}
