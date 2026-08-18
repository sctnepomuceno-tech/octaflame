"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteUserSchema,
  updateUserSchema,
  deactivateUserSchema,
  type InviteUserInput,
  type UpdateUserInput,
  type DeactivateUserInput,
} from "@/lib/validation/users";
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

/**
 * Cancels an in-flight invite from the user's row directly (§5.6), rather
 * than requiring the admin find the matching row in the separate Pending
 * invitations list. Same effect as revokeInvitation, keyed by user instead
 * of invitation id: marks the pending user_invitations row 'revoked' and
 * deactivates the profile so it isn't left open.
 */
export async function cancelInviteForUser(userId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, email, active, must_change_password")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }
  if (!target.must_change_password) {
    return { error: "This user already completed setup — deactivate instead." };
  }
  if (!target.active) {
    return { error: "This user is already deactivated." };
  }

  const { data: invitation } = await admin
    .from("user_invitations")
    .select("id")
    .eq("status", "pending")
    .ilike("email", target.email)
    .maybeSingle();

  if (invitation) {
    await admin.from("user_invitations").update({ status: "revoked" }).eq("id", invitation.id);
  }

  const { error: deactivateError } = await admin
    .from("profiles")
    .update({ active: false, deactivated_at: new Date().toISOString(), deactivated_by: actingProfile.id })
    .eq("id", userId);
  if (deactivateError) {
    return { error: deactivateError.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.invitation_revoked",
    table_name: "profiles",
    record_id: userId,
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: true };
}

/** True if the profile's effective permission set includes users.manage (§5.1: management implicitly has everything). */
function hasUsersManage(role: string, permissions: string[]): boolean {
  return role === "management" || permissions.includes("users.manage");
}

async function activeManagementCount(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "management")
    .eq("active", true);
  return count ?? 0;
}

/**
 * Edits an existing user's role, DSP territory, and permissions from the
 * user detail screen (§5.8, §5.10). Guards: self-demotion/self-lockout,
 * the last active Management account, one active user per DSP, and a
 * type-to-confirm step before granting users.manage.
 */
export async function updateUser(userId: string, input: UpdateUserInput): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, email, role, dsp_id, permissions, active")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }

  const permissions = resolvePermissions(data.permissions.filter(isPermissionKey));
  const dspId = data.role === "dsp" ? data.dspId ?? null : null;

  const wasManagement = hasUsersManage(target.role, target.permissions);
  const willBeManagement = hasUsersManage(data.role, permissions);

  // §5.8 #4 — cannot self-demote or self-strip users.manage.
  if (userId === actingProfile.id && wasManagement && !willBeManagement) {
    return { error: "You can't remove your own Management access — ask another Management user to do this." };
  }

  // §5.8 #5 — the last active Management account is untouchable.
  if (target.role === "management" && target.active && (data.role !== "management" || !willBeManagement)) {
    const count = await activeManagementCount(admin);
    if (count <= 1) {
      return { error: "This is the last active Management account and can't be demoted or stripped of access. Invite a second Management account first." };
    }
  }

  // §5.8 #2 — granting users.manage to someone who didn't already have it
  // requires typing their email to confirm, checked server-side too.
  if (!wasManagement && willBeManagement) {
    if (!data.confirmEmail || data.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
      return { error: "Type the user's email exactly to confirm granting Management access." };
    }
  }

  // §5.8 last paragraph — demoting Management requires a DSP assignment in the same action.
  if (target.role === "management" && data.role === "dsp" && !dspId) {
    return { error: "Demoting a Management user requires assigning them a DSP territory in the same action." };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: data.role, dsp_id: dspId, permissions })
    .eq("id", userId);

  if (updateError) {
    if (updateError.message.includes("profiles_dsp_id_active_uniq")) {
      return { error: "That DSP territory is already assigned to another active user." };
    }
    return { error: updateError.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.updated",
    table_name: "profiles",
    record_id: userId,
    previous_value: { role: target.role, dsp_id: target.dsp_id, permissions: target.permissions },
    new_value: { role: data.role, dsp_id: dspId, permissions },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: true };
}

/**
 * Deactivates a user and, for a DSP user, runs the handover flow (§5.9):
 * offer a replacement territory owner (an existing DSP-role user with no
 * current territory — promoting a different role inline is out of scope)
 * and bulk-reassign their open tasks so follow-ups don't silently vanish.
 * Customers stay attached to the DSP record and historical sales keep
 * their original created_by — neither is touched here.
 */
export async function deactivateUser(userId: string, input: DeactivateUserInput): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const parsed = deactivateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, role, dsp_id, active")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }
  if (!target.active) {
    return { error: "This user is already deactivated." };
  }

  if (target.role === "management") {
    const count = await activeManagementCount(admin);
    if (count <= 1) {
      return { error: "This is the last active Management account and can't be deactivated. Invite a second Management account first." };
    }
  }

  const { error: deactivateError } = await admin
    .from("profiles")
    .update({ active: false, deactivated_at: new Date().toISOString(), deactivated_by: actingProfile.id })
    .eq("id", userId);
  if (deactivateError) {
    return { error: deactivateError.message };
  }

  let reassignToId: string | null = null;
  if (data.reassignTasksTo === "replacement") {
    reassignToId = data.replacementUserId ?? null;
  } else if (data.reassignTasksTo === "self") {
    reassignToId = actingProfile.id;
  }

  if (reassignToId) {
    const { data: reassigned } = await admin
      .from("tasks")
      .update({ assigned_to: reassignToId })
      .eq("assigned_to", userId)
      .in("status", ["pending", "in_progress"])
      .select("id");

    if (reassigned && reassigned.length > 0) {
      await admin.from("audit_log").insert({
        user_id: actingProfile.id,
        action: "task.bulk_reassigned",
        table_name: "tasks",
        record_id: userId,
        new_value: { from: userId, to: reassignToId, count: reassigned.length },
      });
    }
  }

  if (target.role === "dsp" && target.dsp_id && data.replacementUserId) {
    await admin
      .from("profiles")
      .update({ dsp_id: target.dsp_id })
      .eq("id", data.replacementUserId)
      .eq("role", "dsp");
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.deactivated",
    table_name: "profiles",
    record_id: userId,
    previous_value: { active: true },
    new_value: { active: false, reassign_tasks_to: data.reassignTasksTo, replacement_user_id: data.replacementUserId ?? null },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  revalidatePath("/tasks");
  return { success: true };
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ active: true, deactivated_at: null, deactivated_by: null })
    .eq("id", userId);

  if (error) {
    if (error.message.includes("profiles_dsp_id_active_uniq")) {
      return { error: "That DSP territory is already assigned to another active user. Reassign the territory first." };
    }
    return { error: error.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.reactivated",
    table_name: "profiles",
    record_id: userId,
    new_value: { active: true },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: true };
}

/**
 * Permanently removes a deactivated user so their email can be invited
 * fresh. Only allowed once deactivated — Supabase's inviteUserByEmail
 * refuses to resend to an email that already has any auth.users record
 * (confirmed or not), so a stuck invite has no "resend" path, only this
 * one: delete and re-invite from scratch.
 *
 * Deleting the auth user cascades to the profiles row (profiles_id_fkey
 * ON DELETE CASCADE), but every other table that references profiles(id)
 * (sales.created_by, tasks.assigned_to, audit_log.user_id, ...) does so
 * with no cascade — so this fails safely (nothing is deleted) the moment
 * the user has any real history, which is exactly when they should stay
 * deactivated instead.
 */
export async function deleteDeactivatedUser(userId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, email, full_name, active")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }
  if (target.active) {
    return { error: "Only deactivated users can be deleted. Deactivate them first." };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return {
      error:
        "This user has activity history (sales, tasks, or other records) tied to their account and can't be deleted — keep them deactivated instead.",
    };
  }

  await admin.from("user_invitations").delete().ilike("email", target.email);

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.deleted",
    table_name: "profiles",
    record_id: userId,
    previous_value: { full_name: target.full_name, email: target.email },
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export interface UnassignedDspUser {
  id: string;
  full_name: string;
}

/** Active dsp-role profiles with no current territory — eligible handover replacements (§5.9). */
export async function listUnassignedDspUsers(): Promise<UnassignedDspUser[]> {
  await requirePermission("users.manage");
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "dsp")
    .eq("active", true)
    .is("dsp_id", null)
    .order("full_name");
  return data ?? [];
}
