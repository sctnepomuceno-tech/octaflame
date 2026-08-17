/** Shared column definition every export format (CSV/XLS/XLSX/PDF) renders from. */
export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
  /** ExcelJS number format string, e.g. "#,##0.00" or "₱#,##0.00". XLSX only. */
  numFmt?: string;
  align?: "left" | "right";
}

export interface ExportMeta {
  title: string;
  periodLabel: string;
  generatedBy: string;
  generatedAt: Date;
  /** Key/value pairs shown above the table — totals, counts, etc. */
  summary?: Record<string, string | number>;
}
