import type { Metadata } from "next";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireAnyPermission, profileHasPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { todayInManila, todayDateString } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/database.types";
import { listAssignableUsers } from "@/app/actions/tasks";
import { CalendarFilters } from "./calendar-filters";
import { TaskEditDialog, type EditableTask } from "../task-edit-dialog";

export const metadata: Metadata = { title: "Tasks calendar" };

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

// Monthly grid only for MVP (§10.2 also asks for Daily/Weekly, and drag-to-
// reschedule). The list view's Today/This Week buckets already cover the
// daily/weekly cases, and reschedule is a quick action inside the edit
// dialog rather than drag-and-drop, given the phase's effort budget.
export default async function TasksCalendarPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAnyPermission(["tasks.read.own", "tasks.read.all"]);
  const params = await props.searchParams;

  const monthParam = typeof params.month === "string" ? params.month : "";
  const anchor = /^\d{4}-\d{2}$/.test(monthParam)
    ? new Date(`${monthParam}-01T00:00:00`)
    : todayInManila();

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const prevMonth = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");
  const monthLabel = format(monthStart, "MMMM yyyy");
  const today = todayDateString();

  const canSeeAll = profileHasPermission(profile, "tasks.read.all");
  const dspParam = typeof params.dsp === "string" ? params.dsp : "all";
  const municipalityParam = typeof params.municipality === "string" ? params.municipality : "all";
  const priorityParam = typeof params.priority === "string" ? params.priority : "all";
  const statusParam = typeof params.status === "string" ? params.status : "all";
  const taskTypeParam = typeof params.type === "string" ? params.type : "all";

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, task_type_id, assigned_to, customer_id, municipality_id, due_date, due_time, priority, status, completed_at"
    )
    .gte("due_date", format(gridStart, "yyyy-MM-dd"))
    .lte("due_date", format(gridEnd, "yyyy-MM-dd"))
    .order("priority", { ascending: false });

  if (canSeeAll && dspParam !== "all") query = query.eq("dsp_id", dspParam);
  if (municipalityParam !== "all") query = query.eq("municipality_id", municipalityParam);
  if (priorityParam !== "all") query = query.eq("priority", priorityParam as TaskRow["priority"]);
  if (statusParam !== "all") query = query.eq("status", statusParam as TaskRow["status"]);
  if (taskTypeParam !== "all") query = query.eq("task_type_id", taskTypeParam);

  const [{ data: tasks }, { data: taskTypes }, { data: municipalities }, dspsResult, assignableUsers] =
    await Promise.all([
      query,
      supabase.from("task_types").select("id, name, color").eq("active", true).order("sort_order"),
      supabase.from("municipalities").select("id, name").eq("active", true).order("name"),
      canSeeAll
        ? supabase.from("dsps").select("id, name").eq("active", true).order("name")
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      listAssignableUsers(),
    ]);

  const taskTypeById = new Map((taskTypes ?? []).map((t) => [t.id, t]));
  const tasksByDate = new Map<string, TaskRow[]>();
  for (const t of (tasks ?? []) as TaskRow[]) {
    if (!t.due_date) continue;
    const list = tasksByDate.get(t.due_date) ?? [];
    list.push(t);
    tasksByDate.set(t.due_date, list);
  }

  const editableFields = (t: TaskRow): EditableTask => ({
    id: t.id,
    title: t.title,
    description: t.description,
    task_type_id: t.task_type_id,
    assigned_to: t.assigned_to,
    due_date: t.due_date,
    priority: t.priority,
    status: t.status,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks calendar</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/tasks/calendar?month=${prevMonth}`} aria-label="Previous month">
              <ChevronLeft />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tasks/calendar">Today</Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/tasks/calendar?month=${nextMonth}`} aria-label="Next month">
              <ChevronRight />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tasks">List</Link>
          </Button>
        </div>
      </div>

      <CalendarFilters
        taskTypes={taskTypes ?? []}
        dsps={dspsResult.data ?? []}
        municipalities={municipalities ?? []}
      />

      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateStr) ?? [];
            const inMonth = isSameMonth(day, monthStart);
            const isToday = dateStr === today;
            return (
              <div
                key={dateStr}
                className={
                  "flex min-h-[110px] flex-col gap-1 bg-background p-1.5" +
                  (inMonth ? "" : " opacity-40")
                }
              >
                <span
                  className={
                    isToday
                      ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                      : "text-xs font-medium text-muted-foreground"
                  }
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-1">
                  {dayTasks.slice(0, 3).map((t) => {
                    const type = t.task_type_id ? taskTypeById.get(t.task_type_id) : undefined;
                    const color = type?.color ?? "#94a3b8";
                    return (
                      <TaskEditDialog
                        key={t.id}
                        task={editableFields(t)}
                        taskTypes={taskTypes ?? []}
                        assignableUsers={assignableUsers}
                        trigger={
                          <button
                            type="button"
                            className={
                              "truncate rounded px-1.5 py-0.5 text-left text-xs hover:opacity-80" +
                              (t.status === "completed" || t.status === "cancelled"
                                ? " line-through opacity-60"
                                : "")
                            }
                            style={{ backgroundColor: `${color}22`, color }}
                          >
                            {t.title}
                          </button>
                        }
                      />
                    );
                  })}
                  {dayTasks.length > 3 ? (
                    <span className="px-1.5 text-xs text-muted-foreground">+{dayTasks.length - 3} more</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(taskTypes ?? []).map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="size-3 rounded-full p-0"
              style={{ backgroundColor: t.color, borderColor: t.color }}
            />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}
