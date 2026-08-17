"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validation/users";
import { isPermissionKey, resolvePermissions } from "@/lib/permissions";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function inviteUser(input: InviteUserInput): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");

  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const permissions = resolvePermissions(data.permissions.filter(isPermissionKey));
  const dspId = data.role === "dsp" ? data.dspId ?? null : null;

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", data.email)
    .maybeSingle();
  if (existingProfile) {
    return { error: "A user with this email already exists." };
  }

  const { data: existingInvite } = await admin
    .from("user_invitations")
    .select("id")
    .eq("status", "pending")
    .ilike("email", data.email)
    .maybeSingle();
  if (existingInvite) {
    return { error: "An invitation is already pending for this email." };
  }

  if (data.role === "dsp") {
    const { data: claimed } = await admin
      .from("profiles")
      .select("id")
      .eq("dsp_id", dspId as string)
      .eq("role", "dsp")
      .eq("active", true)
      .maybeSingle();
    if (claimed) {
      return { error: "That DSP territory is already assigned to another active user." };
    }
  }

  const siteUrl = await getSiteUrl();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo: `${siteUrl}/auth/callback`,
    });

  if (inviteError || !invited?.user) {
    return { error: inviteError?.message ?? "Failed to send the invitation email." };
  }

  // Invited users set their own password on first login — same forced gate
  // as the bootstrap account (§5.5, §5.6).
  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    full_name: data.fullName,
    email: data.email,
    phone: data.phone || null,
    role: data.role,
    dsp_id: dspId,
    permissions,
    active: true,
    must_change_password: true,
    invited_by: actingProfile.id,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: profileError.message };
  }

  const { error: invitationError } = await admin.from("user_invitations").insert({
    email: data.email,
    full_name: data.fullName,
    role: data.role,
    dsp_id: dspId,
    permissions,
    invited_by: actingProfile.id,
    status: "pending",
  });

  if (invitationError) {
    return { error: invitationError.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.invited",
    table_name: "profiles",
    record_id: invited.user.id,
    new_value: { full_name: data.fullName, email: data.email, role: data.role, dsp_id: dspId, permissions },
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export async function resendInvitation(invitationId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { data: invitation, error: fetchError } = await admin
    .from("user_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (fetchError || !invitation) {
    return { error: "Invitation not found." };
  }
  if (invitation.status !== "pending") {
    return { error: "Only pending invitations can be resent." };
  }

  const siteUrl = await getSiteUrl();
  const { error: resendError } = await admin.auth.admin.inviteUserByEmail(
    invitation.email,
    { redirectTo: `${siteUrl}/auth/callback` }
  );

  if (resendError) {
    return { error: resendError.message };
  }

  await admin
    .from("user_invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", invitationId);

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.invitation_resent",
    table_name: "user_invitations",
    record_id: invitationId,
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { data: invitation, error: fetchError } = await admin
    .from("user_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (fetchError || !invitation) {
    return { error: "Invitation not found." };
  }
  if (invitation.status !== "pending") {
    return { error: "Only pending invitations can be revoked." };
  }

  const { error: revokeError } = await admin
    .from("user_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);
  if (revokeError) {
    return { error: revokeError.message };
  }

  // The profile/auth user were created eagerly at invite time (§5.6) — an
  // unaccepted, revoked invitation must not sit open, so deactivate it.
  // Never hard-delete (§5.9).
  const { data: matchingProfile } = await admin
    .from("profiles")
    .select("id, active")
    .ilike("email", invitation.email)
    .eq("must_change_password", true)
    .maybeSingle();

  if (matchingProfile?.active) {
    await admin
      .from("profiles")
      .update({ active: false, deactivated_at: new Date().toISOString(), deactivated_by: actingProfile.id })
      .eq("id", matchingProfile.id);
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.invitation_revoked",
    table_name: "user_invitations",
    record_id: invitationId,
  });

  revalidatePath("/settings/users");
  return { success: true };
}
