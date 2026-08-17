"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission, requireProfile } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { taskFormSchema, type TaskFormInput } from "@/lib/validation/tasks";

export interface ActionResult<T = undefined> {
  error?: string;
  success?: boolean;
  data?: T;
}

export async function createTask(input: TaskFormInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireAnyPermission(["tasks.create"]);

  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // dsp_id, when not explicit, is derived from the acting DSP's own scope —
  // never trusted from the client beyond that (§4.1 #4).
  const dspId = data.dspId ?? (profile.role === "dsp" ? profile.dsp_id : null);

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      title: data.title,
      description: data.description || null,
      task_type_id: data.taskTypeId || null,
      assigned_to: data.assignedTo,
      assigned_by: profile.id,
      customer_id: data.customerId || null,
      municipality_id: data.municipalityId || null,
      dsp_id: dspId,
      sale_id: data.saleId || null,
      due_date: data.dueDate || null,
      due_time: data.dueTime || null,
      priority: data.priority,
      tags: data.tags,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create task." };
  }

  revalidatePath("/tasks");
  if (data.customerId) revalidatePath(`/customers/${data.customerId}`);
  revalidatePath("/");
  return { success: true, data: { id: inserted.id } };
}

export async function updateTaskStatus(
  id: string,
  status: "pending" | "in_progress" | "completed" | "cancelled",
  extra?: { completionNotes?: string; cancelledReason?: string }
): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("customer_id")
    .eq("id", id)
    .single();
  if (fetchError || !task) {
    return { error: "Task not found." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      completion_notes: status === "completed" ? extra?.completionNotes || null : undefined,
      cancelled_reason: status === "cancelled" ? extra?.cancelledReason || null : undefined,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tasks");
  if (task.customer_id) revalidatePath(`/customers/${task.customer_id}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateTask(
  id: string,
  input: Partial<TaskFormInput> & { status?: "pending" | "in_progress" | "completed" | "cancelled" }
): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("customer_id")
    .eq("id", id)
    .single();
  if (fetchError || !task) {
    return { error: "Task not found." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.taskTypeId !== undefined ? { task_type_id: input.taskTypeId || null } : {}),
      ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}),
      ...(input.dueDate !== undefined ? { due_date: input.dueDate || null } : {}),
      ...(input.dueTime !== undefined ? { due_time: input.dueTime || null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/calendar");
  if (task.customer_id) revalidatePath(`/customers/${task.customer_id}`);
  revalidatePath("/");
  return { success: true };
}

export interface AssignableUser {
  id: string;
  full_name: string;
}

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!profile.dsp_id && profile.role !== "dsp") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name");
    return data ?? [];
  }

  return [{ id: profile.id, full_name: profile.full_name }];
}
