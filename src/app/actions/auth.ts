"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema, changePasswordSchema } from "@/lib/validation/auth";

export interface ActionResult {
  error?: string;
}

export async function signIn(
  _prevState: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(
  _prevState: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: updateAuthError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateAuthError) {
    return { error: updateAuthError.message };
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (updateProfileError) {
    return { error: updateProfileError.message };
  }

  // Best-effort: mark a matching pending invitation as accepted now that
  // the invited user has set their password (§5.6). user_invitations has no
  // client write policy (§5.6), so this goes through the admin client.
  if (user.email) {
    await createAdminClient()
      .from("user_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("email", user.email)
      .eq("status", "pending");
  }

  redirect("/");
}
