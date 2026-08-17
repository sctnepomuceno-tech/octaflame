import type { Metadata } from "next";
import Link from "next/link";
import { endOfWeek, format } from "date-fns";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { todayInManila, todayDateString } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { listAssignableUsers } from "@/app/actions/tasks";
import type { Database } from "@/lib/supabase/database.types";
import { TaskFilters } from "./task-filters";
import { TaskQuickComplete } from "./task-quick-complete";
import { TaskEditDialog } from "./task-edit-dialog";

export const metadata: Metadata = { title: "Tasks" };

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const PRIORITY_VARIANT: Record<TaskRow["priority"], "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default async function TasksPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAnyPermission(["tasks.read.own", "tasks.read.all"]);
  const params = await props.searchParams;
  const TASK_STATUSES: TaskRow["status"][] = ["pending", "in_progress", "completed", "cancelled"];
  const statusParam = typeof params.status === "string" ? params.status : "open";
  const status = statusParam === "open" ? "open" : TASK_STATUSES.find((s) => s === statusParam);
  const priority = typeof params.priority === "string" ? params.priority : "all";
  const taskTypeId = typeof params.type === "string" ? params.type : "all";

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, task_type_id, assigned_to, customer_id, municipality_id, due_date, due_time, priority, status, completed_at"
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "open") {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["pending", "in_progress"]);
  }
  if (priority !== "all") {
    query = query.eq("priority", priority as TaskRow["priority"]);
  }
  if (taskTypeId !== "all") {
    query = query.eq("task_type_id", taskTypeId);
  }

  const [{ data: tasks }, { data: taskTypes }, assignableUsers] = await Promise.all([
    query,
    supabase.from("task_types").select("id, name, color").eq("active", true).order("sort_order"),
    listAssignableUsers(),
  ]);

  const allTasks = tasks ?? [];
  const customerIds = [...new Set(allTasks.map((t) => t.customer_id).filter((id): id is string => !!id))];
  const assignedIds = [...new Set(allTasks.map((t) => t.assigned_to))];

  const [{ data: customers }, { data: assignees }] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, business_name, owner_name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string | null; owner_name: string }[] }),
    assignedIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", assignedIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const taskTypeById = new Map((taskTypes ?? []).map((t) => [t.id, t]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const assigneeById = new Map((assignees ?? []).map((a) => [a.id, a]));

  const today = todayDateString();
  const weekEnd = format(endOfWeek(todayInManila(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const overdue: TaskRow[] = [];
  const dueToday: TaskRow[] = [];
  const thisWeek: TaskRow[] = [];
  const later: TaskRow[] = [];

  for (const t of allTasks as TaskRow[]) {
    const openStatus = t.status === "pending" || t.status === "in_progress";
    if (t.due_date && t.due_date < today && openStatus) {
      overdue.push(t);
    } else if (t.due_date === today) {
      dueToday.push(t);
    } else if (t.due_date && t.due_date > today && t.due_date <= weekEnd) {
      thisWeek.push(t);
    } else {
      later.push(t);
    }
  }

  const buckets: { label: string; rows: TaskRow[] }[] = [
    { label: "Overdue", rows: overdue },
    { label: "Today", rows: dueToday },
    { label: "This week", rows: thisWeek },
    { label: "Later", rows: later },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">{allTasks.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/tasks/calendar">Calendar</Link>
          </Button>
          <TaskFormDialog
            taskTypes={taskTypes ?? []}
            assignableUsers={assignableUsers}
            defaultAssigneeId={profile.id}
          />
        </div>
      </div>

      <TaskFilters taskTypes={taskTypes ?? []} />

      <div className="flex flex-col gap-4">
        {buckets.map((bucket) =>
          bucket.rows.length === 0 ? null : (
            <Card key={bucket.label} className="py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {bucket.label} · {bucket.rows.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {bucket.rows.map((t) => {
                  const type = t.task_type_id ? taskTypeById.get(t.task_type_id) : undefined;
                  const customer = t.customer_id ? customerById.get(t.customer_id) : undefined;
                  const assignee = assigneeById.get(t.assigned_to);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <TaskQuickComplete taskId={t.id} completed={t.status === "completed"} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <TaskEditDialog
                            task={t}
                            taskTypes={taskTypes ?? []}
                            assignableUsers={assignableUsers}
                            trigger={
                              <button
                                type="button"
                                className={
                                  t.status === "completed"
                                    ? "truncate text-left font-medium text-muted-foreground line-through hover:underline"
                                    : "truncate text-left font-medium hover:underline"
                                }
                              >
                                {t.title}
                              </button>
                            }
                          />
                          {type ? (
                            <Badge
                              variant="outline"
                              style={{ borderColor: type.color, color: type.color }}
                            >
                              {type.name}
                            </Badge>
                          ) : null}
                          <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {customer ? (
                            <Link href={`/customers/${customer.id}`} className="hover:underline">
                              {customer.business_name || customer.owner_name}
                            </Link>
                          ) : null}
                          {assignee && assignee.id !== profile.id ? <span>→ {assignee.full_name}</span> : null}
                          {t.due_date ? (
                            <span>
                              {t.due_date}
                              {t.due_time ? ` ${t.due_time.slice(0, 5)}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )
        )}
        {allTasks.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No tasks match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
