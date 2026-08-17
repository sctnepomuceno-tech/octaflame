/** Filename pattern from §11: octaflame_{report}_{from}_to_{to}.{ext} */
export function exportFilename(report: string, from: string, to: string, ext: string): string {
  const slug = report
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `octaflame_${slug}_${from}_to_${to}.${ext}`;
}
