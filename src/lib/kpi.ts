/**
 * KPI pace and forecast (§7.4). Pure and framework-free — the same
 * "single source of truth" discipline as src/lib/volume, so the
 * Management dashboard and the DSP dashboard's company gauge never
 * compute this differently.
 */

export type PaceStatus = "on_track" | "behind";

export interface KpiPace {
  progressPct: number;
  expectedPct: number;
  paceStatus: PaceStatus;
  /** Full-year forecast at the current run rate. */
  forecast: number;
  /** How much more per remaining month is needed to hit target. */
  requiredPerMonth: number;
  monthsRemaining: number;
}

function daysInYear(year: number): number {
  const startOfYear = Date.UTC(year, 0, 1);
  const startOfNextYear = Date.UTC(year + 1, 0, 1);
  return Math.round((startOfNextYear - startOfYear) / 86_400_000);
}

function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const startOfToday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((startOfToday - startOfYear) / 86_400_000) + 1;
}

export function computeKpiPace(actual: number, target: number, asOf: Date = new Date()): KpiPace {
  const year = asOf.getUTCFullYear();
  const totalDays = daysInYear(year);
  const daysElapsed = Math.min(totalDays, Math.max(1, dayOfYear(asOf)));

  const progressPct = target > 0 ? actual / target : 0;
  const expectedPct = daysElapsed / totalDays;
  const paceStatus: PaceStatus = progressPct >= expectedPct ? "on_track" : "behind";
  const forecast = (actual / daysElapsed) * totalDays;

  const monthsElapsed = asOf.getUTCMonth() + 1;
  const monthsRemaining = Math.max(1, 12 - monthsElapsed);
  const requiredPerMonth = Math.max(0, (target - actual) / monthsRemaining);

  return { progressPct, expectedPct, paceStatus, forecast, requiredPerMonth, monthsRemaining };
}

/** e.g. "On pace for 11.8 MT — 2.65 MT behind target. Needs 662 crates/month for the remaining 4 months." */
export function volumePaceSummary(
  pace: KpiPace,
  target: number,
  requiredCratesPerMonth: number,
  formatMt: (mt: number) => string
): string {
  const gap = Math.abs(target - pace.forecast);
  const status =
    pace.paceStatus === "on_track"
      ? `On pace for ${formatMt(pace.forecast)} — ahead of target.`
      : `On pace for ${formatMt(pace.forecast)} — ${formatMt(gap)} behind target.`;

  if (pace.paceStatus === "on_track") {
    return status;
  }

  return `${status} Needs ${Math.ceil(requiredCratesPerMonth).toLocaleString()} crates/month for the remaining ${pace.monthsRemaining} month${pace.monthsRemaining === 1 ? "" : "s"}.`;
}

export function accountsPaceSummary(pace: KpiPace): string {
  const roundedForecast = Math.round(pace.forecast);
  if (pace.paceStatus === "on_track") {
    return `On pace for ${roundedForecast} accounts — ahead of target.`;
  }
  return `On pace for ${roundedForecast} accounts — needs ${Math.ceil(pace.requiredPerMonth)} new accounts/month for the remaining ${pace.monthsRemaining} month${pace.monthsRemaining === 1 ? "" : "s"}.`;
}
