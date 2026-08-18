"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/current-user";
import { VIEW_AS_COOKIE } from "@/lib/auth/view-as";
import { ROLES, type Role } from "@/lib/permissions";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/** Only Management may set this — enforced here, not just hidden in the UI. */
export async function setViewAsRole(role: Role | null): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "management") {
    return { error: "Only Management can preview other role views." };
  }
  if (role !== null && (role === "management" || !ROLES.includes(role))) {
    return { error: "Invalid role." };
  }

  const store = await cookies();
  if (role === null) {
    store.delete(VIEW_AS_COOKIE);
  } else {
    store.set(VIEW_AS_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}
