import type { Metadata } from "next";
import { format } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { getKpiTargets } from "@/app/actions/kpi-targets";
import { getVolumeConstants } from "@/lib/volume/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnualAccountsRow } from "./annual-accounts-row";
import { KpiTargetRow } from "./kpi-target-row";

export const metadata: Metadata = { title: "KPI Targets" };

const CURRENT_YEAR = new Date().getFullYear();

export default async function KpiTargetsPage() {
  await requirePermission("settings.manage");

  const [rows, volumeConstants] = await Promise.all([getKpiTargets(CURRENT_YEAR), getVolumeConstants()]);
  const annual = rows.find((r) => r.month === null);
  const monthlyByMonth = new Map(rows.filter((r) => r.month !== null).map((r) => [r.month, r]));
  const canistersPerCrate = volumeConstants.canistersPerCrate;

  const annualCanistersTarget = [...monthlyByMonth.values()].reduce(
    (sum, r) => sum + (r.canisters_target ?? 0),
    0
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">KPI Targets</h1>
        <p className="text-sm text-muted-foreground">
          Volume is tracked by month, in crates (pcs = crates × {canistersPerCrate} canisters per
          crate). The dashboard also shows a week-by-week view, split evenly from that month&apos;s
          target. The accounts target stays a single year-end number.
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">{CURRENT_YEAR} annual target</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <AnnualAccountsRow year={CURRENT_YEAR} accountsTarget={annual?.accounts_target ?? 500} />
          <p className="pt-2 text-xs text-muted-foreground">
            Volume has no annual target to set — it&apos;s an overview: this year&apos;s monthly
            targets sum to{" "}
            <span className="font-medium text-foreground">
              {annualCanistersTarget.toLocaleString()} pcs ({(annualCanistersTarget / canistersPerCrate).toLocaleString()} crates)
            </span>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Monthly volume targets</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y pb-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const target = monthlyByMonth.get(month);
            const label = format(new Date(CURRENT_YEAR, month - 1, 1), "MMMM");
            return (
              <KpiTargetRow
                key={month}
                year={CURRENT_YEAR}
                month={month}
                label={label}
                canistersTarget={target?.canisters_target ?? 0}
                canistersPerCrate={canistersPerCrate}
                hasTarget={Boolean(target?.canisters_target)}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
