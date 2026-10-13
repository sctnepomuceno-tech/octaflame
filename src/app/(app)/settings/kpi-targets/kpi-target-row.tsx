"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { clearMonthlyKpiTarget, upsertMonthlyCanistersTarget } from "@/app/actions/kpi-targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Editable as crates — canisters_target (the stored unit) is crates × canistersPerCrate. */
export function KpiTargetRow({
  year,
  month,
  label,
  canistersTarget,
  canistersPerCrate,
  hasTarget,
}: {
  year: number;
  month: number;
  label: string;
  canistersTarget: number;
  canistersPerCrate: number;
  hasTarget: boolean;
}) {
  const [crates, setCrates] = useState(String(canistersTarget ? canistersTarget / canistersPerCrate : 0));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cratesNum = Number(crates);
  const canistersPreview = Number.isFinite(cratesNum) ? cratesNum * canistersPerCrate : 0;

  function save() {
    if (!Number.isFinite(cratesNum) || cratesNum < 0) {
      toast.error("Enter a valid number of crates.");
      return;
    }
    startTransition(async () => {
      const result = await upsertMonthlyCanistersTarget({
        year,
        month,
        canistersTarget: Math.round(cratesNum * canistersPerCrate),
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
    startTransition(async () => {
      const result = await clearMonthlyKpiTarget(year, month);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} target cleared.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-28 shrink-0 text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Crates</span>
        <Input
          type="number"
          min="0"
          step="1"
          value={crates}
          onChange={(e) => setCrates(e.target.value)}
          className="h-8 w-20"
        />
      </div>
      <span className="w-32 shrink-0 text-xs text-muted-foreground">
        = {canistersPreview.toLocaleString()} pcs
      </span>
      <Button size="sm" variant="secondary" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
      {hasTarget ? (
        <Button size="sm" variant="ghost" onClick={clear} disabled={pending} title="Clear target">
          <X />
        </Button>
      ) : null}
    </div>
  );
}
