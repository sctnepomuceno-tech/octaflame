"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { clearMonthlyKpiTarget, upsertKpiTarget } from "@/app/actions/kpi-targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function KpiTargetRow({
  year,
  month,
  label,
  accountsTarget,
  volumeTargetMt,
  hasOverride,
}: {
  year: number;
  month: number | null;
  label: string;
  accountsTarget: number;
  volumeTargetMt: number;
  hasOverride: boolean;
}) {
  const [accounts, setAccounts] = useState(String(accountsTarget));
  const [volume, setVolume] = useState(String(volumeTargetMt));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const accountsTargetNum = Number(accounts);
    const volumeTargetMtNum = Number(volume);
    if (!Number.isFinite(accountsTargetNum) || !Number.isFinite(volumeTargetMtNum)) {
      toast.error("Enter valid numbers.");
      return;
    }
    startTransition(async () => {
      const result = await upsertKpiTarget({
        year,
        month,
        accountsTarget: accountsTargetNum,
        volumeTargetMt: volumeTargetMtNum,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} target saved.`);
      router.refresh();
    });
  }

  function clear() {
    if (month === null) return;
    startTransition(async () => {
      const result = await clearMonthlyKpiTarget(year, month);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} override cleared.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-28 shrink-0 text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Volume (MT)</span>
        <Input
          type="number"
          min="0"
          step="0.001"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          className="h-8 w-24"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Accounts</span>
        <Input
          type="number"
          min="0"
          step="1"
          value={accounts}
          onChange={(e) => setAccounts(e.target.value)}
          className="h-8 w-20"
        />
      </div>
      <Button size="sm" variant="secondary" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
      {month !== null && hasOverride ? (
        <Button size="sm" variant="ghost" onClick={clear} disabled={pending} title="Clear override">
          <X />
        </Button>
      ) : null}
    </div>
  );
}
