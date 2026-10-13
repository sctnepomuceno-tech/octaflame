"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { upsertAnnualAccountsTarget } from "@/app/actions/kpi-targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnnualAccountsRow({ year, accountsTarget }: { year: number; accountsTarget: number }) {
  const [accounts, setAccounts] = useState(String(accountsTarget));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const accountsTargetNum = Number(accounts);
    if (!Number.isFinite(accountsTargetNum)) {
      toast.error("Enter a valid number.");
      return;
    }
    startTransition(async () => {
      const result = await upsertAnnualAccountsTarget({ year, accountsTarget: accountsTargetNum });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Annual accounts target saved.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-28 shrink-0 text-sm font-medium">Accounts</span>
      <Input
        type="number"
        min="0"
        step="1"
        value={accounts}
        onChange={(e) => setAccounts(e.target.value)}
        className="h-8 w-24"
      />
      <span className="text-xs text-muted-foreground">RTL + WS accounts by year end</span>
      <Button size="sm" variant="secondary" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
    </div>
  );
}
