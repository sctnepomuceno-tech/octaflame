import type { Metadata } from "next";
import { format, subMonths } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { todayInManila } from "@/lib/dates";
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
import { ClosePeriodDialog } from "./close-period-dialog";
import { ReopenPeriodDialog } from "./reopen-period-dialog";

export const metadata: Metadata = { title: "Periods" };

export default async function PeriodsPage() {
  await requirePermission("settings.manage");

  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("accounting_periods")
    .select("year, month, status, closed_at, reopened_at, reopen_reason");

  const periodByKey = new Map((periods ?? []).map((p) => [`${p.year}-${p.month}`, p]));

  const now = todayInManila();
  const months = Array.from({ length: 12 }, (_, i) => subMonths(now, i));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Periods</h1>
        <p className="text-sm text-muted-foreground">
          Close a month once it&apos;s reconciled. Closing blocks new sales
          dated in that month (§7.10).
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Last 12 months</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => {
              const year = m.getFullYear();
              const month = m.getMonth() + 1;
              const label = format(m, "MMMM yyyy");
              const period = periodByKey.get(`${year}-${month}`);
              const closed = period?.status === "closed";
              return (
                <TableRow key={`${year}-${month}`}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell>
                    {closed ? (
                      <Badge variant="destructive">Closed</Badge>
                    ) : (
                      <Badge variant="success">Open</Badge>
                    )}
                    {period?.reopen_reason ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        reopened: {period.reopen_reason}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {closed ? (
                      <ReopenPeriodDialog year={year} month={month} label={label} />
                    ) : (
                      <ClosePeriodDialog year={year} month={month} label={label} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
