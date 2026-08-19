"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword } from "@/lib/security/temp-password";
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
  tempPassword?: string;
  /** deleteUser only: the hard delete was refused (real history exists) so access was revoked instead. */
  deactivatedInstead?: boolean;
}

/**
 * Creates the account with a system-generated temporary password instead of
 * emailing an invite link (§5.6). Supabase's invite/magic-link email
 * requires a working Redirect URLs allow-list and a non-rate-limited mailer
 * to reach the user at all — a temp password sidesteps both: Management
 * gets it back immediately to hand to the invitee directly, no email step
 * in the loop. must_change_password still forces them to set their own
 * password on first login.
 */
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

  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });

  if (createError || !created?.user) {
    return { error: createError?.message ?? "Failed to create the account." };
  }

  // Invited users set their own password on first login — same forced gate
  // as the bootstrap account (§5.5, §5.6).
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
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
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.invited",
    table_name: "profiles",
    record_id: created.user.id,
    new_value: { full_name: data.fullName, email: data.email, role: data.role, dsp_id: dspId, permissions },
  });

  revalidatePath("/settings/users");
  return { success: true, tempPassword };
}

/**
 * Issues a fresh temporary password for a user who hasn't completed
 * first-login setup yet — covers both a brand-new invite the admin needs to
 * hand off again and a user stuck from before this flow existed. Reactivates
 * first if needed (respecting the one-active-user-per-DSP constraint).
 */
export async function issueTempPassword(userId: string): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, active, must_change_password")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }
  if (!target.must_change_password) {
    return { error: "This user already set their own password — reactivate instead." };
  }

  if (!target.active) {
    const { error: reactivateError } = await admin
      .from("profiles")
      .update({ active: true, deactivated_at: null, deactivated_by: null })
      .eq("id", userId);
    if (reactivateError) {
      if (reactivateError.message.includes("profiles_dsp_id_active_uniq")) {
        return { error: "That DSP territory is already assigned to another active user. Reassign the territory first." };
      }
      return { error: reactivateError.message };
    }
  }

  const tempPassword = generateTempPassword();
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (passwordError) {
    return { error: passwordError.message };
  }

  await admin.from("audit_log").insert({
    user_id: actingProfile.id,
    action: "user.temp_password_issued",
    table_name: "profiles",
    record_id: userId,
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: true, tempPassword };
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
 * Deletes a user account outright — Management's only removal action now,
 * no separate "deactivate" step to think about. For an active DSP user
 * this still runs the handover flow first (§5.9): offer a replacement
 * territory owner and bulk-reassign open tasks, so follow-ups don't
 * silently vanish. Customers stay attached to the DSP record and
 * historical sales keep their original created_by — neither is touched.
 *
 * Deleting the auth user cascades to the profiles row (profiles_id_fkey
 * ON DELETE CASCADE), but every other table that references profiles(id)
 * (sales.created_by, tasks.assigned_to, audit_log.user_id, ...) does so
 * with no cascade — so if this user has any real history, the delete
 * step fails safely and their access is left revoked (profile set
 * inactive) instead of the account vanishing out from under those
 * records. Never overwrites history, just can't remove it either.
 */
export async function deleteUser(userId: string, input?: DeactivateUserInput): Promise<ActionResult> {
  const actingProfile = await requirePermission("users.manage");
  const admin = createAdminClient();

  if (userId === actingProfile.id) {
    return { error: "You can't delete your own account — ask another Management user to do this." };
  }

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("id, role, dsp_id, active, full_name, email")
    .eq("id", userId)
    .single();
  if (fetchError || !target) {
    return { error: "User not found." };
  }

  if (target.active && target.role === "management") {
    const count = await activeManagementCount(admin);
    if (count <= 1) {
      return { error: "This is the last active Management account and can't be removed. Invite a second Management account first." };
    }
  }

  if (target.active) {
    const parsed = deactivateUserSchema.safeParse(input ?? { reassignTasksTo: "none" });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const data = parsed.data;

    // Revoke access immediately, before attempting the real delete —
    // if the delete below fails, this is the fallback state they're left in.
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
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  revalidatePath("/tasks");

  if (deleteError) {
    await admin.from("audit_log").insert({
      user_id: actingProfile.id,
      action: "user.deactivated",
      table_name: "profiles",
      record_id: userId,
      previous_value: { active: true },
    });
    return {
      success: true,
      deactivatedInstead: true,
      error:
        "This account has activity history (sales, tasks, or other records) and can't be fully deleted, so access has been revoked instead — their historical records stay intact.",
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
