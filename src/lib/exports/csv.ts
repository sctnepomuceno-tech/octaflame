import Papa from "papaparse";

import type { ExportColumn } from "./types";

export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.header, c.value(row)]))
  );
  return Papa.unparse(data, { columns: columns.map((c) => c.header) });
}
