import type { Metadata } from "next";
import { format } from "date-fns";

import { requirePermission } from "@/lib/auth/current-user";
import { getKpiTargets } from "@/app/actions/kpi-targets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTargetRow } from "./kpi-target-row";

export const metadata: Metadata = { title: "KPI Targets" };

const CURRENT_YEAR = new Date().getFullYear();

export default async function KpiTargetsPage() {
  await requirePermission("settings.manage");

  const rows = await getKpiTargets(CURRENT_YEAR);
  const annual = rows.find((r) => r.month === null);
  const monthlyByMonth = new Map(rows.filter((r) => r.month !== null).map((r) => [r.month, r]));

  const fallbackAccounts = annual ? Math.round(annual.accounts_target / 12) : 0;
  const fallbackVolume = annual ? Number((annual.volume_target_mt / 12).toFixed(3)) : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">KPI Targets</h1>
        <p className="text-sm text-muted-foreground">
          The annual target drives the Management dashboard&apos;s overall
          pace gauges. Set a monthly override when a specific month needs
          its own goal (e.g. a seasonal push) — the dashboard shows it as
          that month&apos;s KPI instead of the annual target split evenly.
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">{CURRENT_YEAR} annual target</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <KpiTargetRow
            year={CURRENT_YEAR}
            month={null}
            label="Annual"
            accountsTarget={annual?.accounts_target ?? 300}
            volumeTargetMt={annual?.volume_target_mt ?? 14.45}
            hasOverride={false}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Monthly overrides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y pb-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const override = monthlyByMonth.get(month);
            const label = format(new Date(CURRENT_YEAR, month - 1, 1), "MMMM");
            return (
              <KpiTargetRow
                key={month}
                year={CURRENT_YEAR}
                month={month}
                label={label}
                accountsTarget={override?.accounts_target ?? fallbackAccounts}
                volumeTargetMt={override?.volume_target_mt ?? fallbackVolume}
                hasOverride={Boolean(override)}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
