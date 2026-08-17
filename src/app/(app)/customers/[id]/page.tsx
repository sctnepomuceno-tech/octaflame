import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Megaphone,
  PackageCheck,
  ReceiptText,
  StickyNote,
  UserPlus,
} from "lucide-react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCount, formatCurrency, formatKg } from "@/lib/volume";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE, todayDateString } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerStatusBadge } from "../customer-status-badge";
import { EditCustomerButton } from "./edit-customer-button";
import { RecordEmptiesButton } from "@/components/record-empties-button";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { TaskEditDialog, type EditableTask } from "../../tasks/task-edit-dialog";
import { TaskQuickComplete } from "../../tasks/task-quick-complete";
import { listAssignableUsers } from "@/app/actions/tasks";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Customer" };

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activity_log"]["Row"];

const PRIORITY_VARIANT: Record<TaskRow["priority"], "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const ACTIVITY_ICON: Record<ActivityRow["activity_type"], typeof CalendarClock> = {
  customer_created: UserPlus,
  sale: ReceiptText,
  task_created: CalendarClock,
  task_completed: CheckCircle2,
  collateral_delivered: Megaphone,
  status_changed: PackageCheck,
  note: StickyNote,
};

export default async function CustomerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireAnyPermission(["customers.read.own", "customers.read.all"]);
  const { id } = await props.params;

  const supabase = await createClient();

  const [
    { data: customer },
    { data: municipalities },
    { data: sales },
    { data: emptiesBalances },
    { data: tasks },
    { data: taskTypes },
    { data: activity },
    assignableUsers,
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("municipalities").select("id, name"),
    supabase
      .from("sales")
      .select("id, sale_date, receipt_no, total_amount, total_volume_kg, payment_status, empties_variance")
      .eq("customer_id", id)
      .order("sale_date", { ascending: false })
      .limit(10),
    supabase.from("customer_empties_balance").select("item_type, balance").eq("customer_id", id),
    supabase
      .from("tasks")
      .select(
        "id, title, description, task_type_id, assigned_to, due_date, due_time, priority, status, completed_at"
      )
      .eq("customer_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase.from("task_types").select("id, name, color").eq("active", true).order("sort_order"),
    supabase
      .from("activity_log")
      .select("id, activity_type, activity_date, title, description")
      .eq("customer_id", id)
      .order("activity_date", { ascending: false })
      .limit(30),
    listAssignableUsers(),
  ]);

  if (!customer) {
    notFound();
  }

  const today = todayDateString();
  const allTasks = (tasks ?? []) as TaskRow[];
  const overdueTasks = allTasks.filter(
    (t) => (t.status === "pending" || t.status === "in_progress") && t.due_date && t.due_date < today
  );
  const upcomingTasks = allTasks.filter(
    (t) => (t.status === "pending" || t.status === "in_progress") && (!t.due_date || t.due_date >= today)
  );
  const completedTasks = allTasks.filter((t) => t.status === "completed" || t.status === "cancelled");
  const taskTypeById = new Map((taskTypes ?? []).map((t) => [t.id, t]));

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

  const municipalityName =
    (municipalities ?? []).find((m) => m.id === customer.municipality_id)?.name ?? "—";

  const emptiesOwed = Math.max(
    (emptiesBalances ?? []).find((b) => b.item_type === "canister_shell")?.balance ?? 0,
    0
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {customer.business_name || customer.owner_name}
            </h1>
            <Badge variant="secondary">{customer.customer_type}</Badge>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="text-sm text-muted-foreground">{municipalityName}</p>
        </div>
        <EditCustomerButton
          customer={customer}
          municipalities={municipalities ?? []}
        />
      </div>

      {emptiesOwed > 0 ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center justify-between gap-2 py-4 text-sm">
            <span>
              ⚠ Owes <span className="font-semibold tabular-nums">{formatCount(emptiesOwed)}</span> empty shell{emptiesOwed === 1 ? "" : "s"}.
            </span>
            <RecordEmptiesButton customerId={id} owed={emptiesOwed} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div><span className="text-muted-foreground">Owner:</span> {customer.owner_name || "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {customer.contact_number || "—"}</div>
            <div><span className="text-muted-foreground">Barangay:</span> {customer.barangay || "—"}</div>
            <div><span className="text-muted-foreground">Address:</span> {customer.address || "—"}</div>
            <div><span className="text-muted-foreground">Landmark:</span> {customer.landmark || "—"}</div>
            {customer.notes ? (
              <div className="mt-2 rounded-md bg-muted p-2 text-muted-foreground">{customer.notes}</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifetime</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Transactions</div>
              <div className="text-lg font-semibold tabular-nums">{customer.total_transactions}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volume</div>
              <div className="text-lg font-semibold tabular-nums">{formatKg(customer.lifetime_volume_kg)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Amount</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(customer.lifetime_amount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg. purchase</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(customer.average_purchase_amount)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sales ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.sale_date}</TableCell>
                <TableCell>
                  <Link href={`/sales/${s.id}`} className="hover:underline">
                    {s.receipt_no}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{s.payment_status}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(s.total_volume_kg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.total_amount)}</TableCell>
              </TableRow>
            ))}
            {(sales ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tasks</CardTitle>
          <TaskFormDialog
            taskTypes={taskTypes ?? []}
            assignableUsers={assignableUsers}
            defaultCustomerId={id}
            defaultAssigneeId={profile.id}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            { label: "Overdue", rows: overdueTasks },
            { label: "Upcoming", rows: upcomingTasks },
            { label: "Completed", rows: completedTasks },
          ].map((bucket) =>
            bucket.rows.length === 0 ? null : (
              <div key={bucket.label} className="flex flex-col gap-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {bucket.label} · {bucket.rows.length}
                </div>
                <div className="flex flex-col divide-y rounded-md border">
                  {bucket.rows.map((t) => {
                    const type = t.task_type_id ? taskTypeById.get(t.task_type_id) : undefined;
                    const done = t.status === "completed" || t.status === "cancelled";
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                        {done ? (
                          <div className="w-4" />
                        ) : (
                          <TaskQuickComplete taskId={t.id} completed={false} />
                        )}
                        <TaskEditDialog
                          task={editableFields(t)}
                          taskTypes={taskTypes ?? []}
                          assignableUsers={assignableUsers}
                          trigger={
                            <button
                              type="button"
                              className={
                                "flex-1 truncate text-left text-sm hover:underline" +
                                (t.status === "completed" ? " text-muted-foreground line-through" : "") +
                                (t.status === "cancelled" ? " text-muted-foreground italic" : "")
                              }
                            >
                              {t.title}
                            </button>
                          }
                        />
                        {type ? (
                          <Badge variant="outline" style={{ borderColor: type.color, color: type.color }}>
                            {type.name}
                          </Badge>
                        ) : null}
                        <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          {t.due_date ?? "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
          {allTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No follow-ups yet for this customer.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {(activity ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {(activity as ActivityRow[]).map((a) => {
                const Icon = ACTIVITY_ICON[a.activity_type];
                return (
                  <li key={a.id} className="flex gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{a.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatInTimeZone(a.activity_date, BUSINESS_TIMEZONE, "MMM d, yyyy · h:mm a")}
                        </span>
                      </div>
                      {a.description ? (
                        <p className="text-sm text-muted-foreground">{a.description}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
