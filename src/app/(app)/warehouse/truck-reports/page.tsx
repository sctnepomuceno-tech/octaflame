import type { Metadata } from "next";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/volume";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewTruckReportDialog } from "./new-truck-report-dialog";

export const metadata: Metadata = { title: "Truck reports" };

export default async function TruckReportsPage() {
  await requireAnyPermission(["truck.read", "truck.create"]);
  const supabase = await createClient();

  const [{ data: reports }, { data: dsps }] = await Promise.all([
    supabase
      .from("truck_reports")
      .select("id, report_date, truck_plate, driver_name, dsp_id, crates_out, crates_returned, fuel_cost")
      .order("report_date", { ascending: false })
      .limit(50),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
  ]);

  const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Truck reports</h1>
          <p className="text-sm text-muted-foreground">Delivery run logs</p>
        </div>
        <NewTruckReportDialog dsps={dsps ?? []} />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Truck</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>DSP</TableHead>
              <TableHead className="text-right">Crates delivered</TableHead>
              <TableHead className="text-right">Fuel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.report_date}</TableCell>
                <TableCell>{r.truck_plate ?? "—"}</TableCell>
                <TableCell>{r.driver_name ?? "—"}</TableCell>
                <TableCell>{dspNameById.get(r.dsp_id ?? "") ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.crates_out - r.crates_returned}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.fuel_cost)}</TableCell>
              </TableRow>
            ))}
            {(reports ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No truck reports yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
