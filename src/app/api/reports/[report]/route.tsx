import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getExportScope } from "@/lib/exports/scope";
import { buildCsv } from "@/lib/exports/csv";
import { buildXlsx } from "@/lib/exports/xlsx";
import { buildXlsHtml } from "@/lib/exports/xls";
import { ReportDocument } from "@/lib/exports/pdf-report";
import { exportFilename } from "@/lib/exports/filename";
import { getReportByKey } from "@/lib/reports/registry";
import type { ReportFilters } from "@/lib/reports/types";
import { daysAgoDateString, todayDateString } from "@/lib/dates";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pdf: "application/pdf",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const profile = await requireAnyPermission(["reports.read.own", "reports.read.all"]);
  const { report: reportKey } = await params;
  const definition = getReportByKey(reportKey);
  if (!definition) {
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }

  const search = request.nextUrl.searchParams;
  const format = search.get("format") ?? "csv";
  if (!CONTENT_TYPES[format]) {
    return NextResponse.json({ error: "Unknown export format." }, { status: 400 });
  }

  const filters: ReportFilters = {
    from: search.get("from") || daysAgoDateString(29),
    to: search.get("to") || todayDateString(),
    dspId: search.get("dsp") || undefined,
    municipalityId: search.get("municipality") || undefined,
    customerId: search.get("customer") || undefined,
    customerType: (search.get("customerType") as ReportFilters["customerType"]) || undefined,
    productId: search.get("product") || undefined,
    paymentStatus: (search.get("paymentStatus") as ReportFilters["paymentStatus"]) || undefined,
    volumeThresholdKg: search.get("volumeThreshold") ? Number(search.get("volumeThreshold")) : undefined,
  };

  const scope = getExportScope(profile);
  const supabase = await createClient();
  const { rows, summary } = await definition.fetch({ supabase, scope, filters });

  const meta = {
    title: definition.label,
    periodLabel: `${filters.from} to ${filters.to}`,
    generatedBy: profile.full_name,
    generatedAt: new Date(),
    summary,
  };

  const filename = exportFilename(definition.label, filters.from, filters.to, format);

  let body: Buffer | string;
  if (format === "csv") {
    body = buildCsv(rows, definition.columns);
  } else if (format === "xlsx") {
    body = await buildXlsx(rows, definition.columns, meta);
  } else if (format === "xls") {
    body = buildXlsHtml(rows, definition.columns, meta);
  } else {
    body = await renderToBuffer(<ReportDocument columns={definition.columns} rows={rows} meta={meta} />);
  }

  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
