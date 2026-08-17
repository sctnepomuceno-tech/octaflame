import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { ExportColumn } from "@/lib/exports/types";
import type { ExportScope } from "@/lib/exports/scope";

/** §11 filter bar. Every report reads whichever of these are relevant to it. */
export interface ReportFilters {
  from: string;
  to: string;
  dspId?: string;
  municipalityId?: string;
  customerId?: string;
  customerType?: "HH" | "RTL" | "WS";
  productId?: string;
  paymentStatus?: "paid" | "partial" | "unpaid";
  volumeThresholdKg?: number;
}

export interface ReportContext {
  supabase: SupabaseClient<Database>;
  scope: ExportScope;
  filters: ReportFilters;
}

export interface ReportResult<T> {
  rows: T[];
  summary?: Record<string, string | number>;
}

export interface ReportDefinition<T = Record<string, unknown>> {
  key: string;
  label: string;
  description: string;
  columns: ExportColumn<T>[];
  fetch: (ctx: ReportContext) => Promise<ReportResult<T>>;
}
