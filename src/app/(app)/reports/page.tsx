import type { Metadata } from "next";

import { requireAnyPermission, profileHasPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { daysAgoDateString, todayDateString } from "@/lib/dates";
import { REPORTS } from "@/lib/reports/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportFilters } from "./report-filters";

export const metadata: Metadata = { title: "Reports" };

const FORMATS: { format: string; label: string }[] = [
  { format: "csv", label: "CSV" },
  { format: "xlsx", label: "XLSX" },
  { format: "xls", label: "XLS" },
  { format: "pdf", label: "PDF" },
];

export default async function ReportsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAnyPermission(["reports.read.own", "reports.read.all"]);
  const params = await props.searchParams;
  const canSeeAll = profileHasPermission(profile, "reports.read.all");

  const from = typeof params.from === "string" && params.from ? params.from : daysAgoDateString(29);
  const to = typeof params.to === "string" && params.to ? params.to : todayDateString();
  const query = new URLSearchParams();
  query.set("from", from);
  query.set("to", to);
  for (const key of ["dsp", "municipality", "customerType", "customer", "product", "paymentStatus", "volumeThreshold"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }

  const supabase = await createClient();
  const [{ data: dsps }, { data: municipalities }] = await Promise.all([
    canSeeAll ? supabase.from("dsps").select("id, name").eq("active", true).order("name") : Promise.resolve({ data: [] }),
    supabase.from("municipalities").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          One-click preset reports. Every export respects your data scope —
          {canSeeAll ? " you see company-wide data." : " you only see your own DSP's data."}
        </p>
      </div>

      <ReportFilters dsps={dsps ?? []} municipalities={municipalities ?? []} />

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.key}>
            <CardHeader>
              <CardTitle className="text-base">{report.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{report.description}</p>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Button key={f.format} variant="outline" size="sm" asChild>
                    <a href={`/api/reports/${report.key}?${query.toString()}&format=${f.format}`}>{f.label}</a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
