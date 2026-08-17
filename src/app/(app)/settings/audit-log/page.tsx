import type { Metadata } from "next";
import { format } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogFilters } from "./audit-log-filters";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 200;

function formatValue(value: Record<string, unknown> | null): string {
  if (!value) return "—";
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
}

export default async function AuditLogPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit.read");
  const params = await props.searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const userId = typeof params.user === "string" ? params.user : "all";
  const tableName = typeof params.table === "string" ? params.table : "all";

  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, user_id, action, table_name, record_id, previous_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (userId !== "all") query = query.eq("user_id", userId);
  if (tableName !== "all") query = query.eq("table_name", tableName);

  const [{ data: entries }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every administrative change, append-only. Nobody — including
          Management — can edit or delete an entry (§6.12, §15.7).
        </p>
      </div>

      <AuditLogFilters users={(profiles ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">{(entries ?? []).length} shown</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(entries ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {format(new Date(e.created_at), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell>{e.user_id ? nameById.get(e.user_id) ?? "—" : "System"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{e.action}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{e.table_name}</TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={formatValue(e.previous_value)}>
                  {formatValue(e.previous_value)}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={formatValue(e.new_value)}>
                  {formatValue(e.new_value)}
                </TableCell>
              </TableRow>
            ))}
            {(entries ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No audit entries match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
