"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { closePeriod, getPeriodPrecheck, type PrecheckRow } from "@/app/actions/periods";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ClosePeriodDialog({ year, month, label }: { year: number; month: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PrecheckRow[] | null>(null);
  const [offlineAck, setOfflineAck] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setLoading(true);
      setRows(null);
      setOfflineAck(false);
      getPeriodPrecheck(year, month)
        .then(setRows)
        .finally(() => setLoading(false));
    }
  }, [open, year, month]);

  const blockers = (rows ?? []).filter((r) => r.item_count > 0);
  const canClose = !loading && rows !== null && blockers.length === 0 && offlineAck;

  function submit() {
    startTransition(async () => {
      const result = await closePeriod(year, month);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} closed.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Lock /> Close
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {label}?</DialogTitle>
          <DialogDescription>
            Closing blocks new sales dated in this month. It can be reopened
            later with a reason, but treat this as a real checkpoint (§7.10).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Running pre-checks…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(rows ?? []).map((r) => (
              <div
                key={r.check_name}
                className={
                  r.item_count > 0
                    ? "flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"
                    : "flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-2 text-sm"
                }
              >
                {r.item_count > 0 ? (
                  <TriangleAlert className="size-4 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                )}
                <span className="flex-1">{r.description}</span>
                {r.item_count > 0 ? <span className="font-semibold tabular-nums">{r.item_count}</span> : null}
              </div>
            ))}

            <label className="mt-2 flex items-start gap-2 rounded-md border p-2 text-sm">
              <Checkbox checked={offlineAck} onCheckedChange={(v) => setOfflineAck(v === true)} className="mt-0.5" />
              <span>
                I&apos;ve confirmed with every DSP that their offline sales
                queue is synced. This can&apos;t be checked automatically —
                the queue lives on each device, not the server.
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button onClick={submit} disabled={!canClose || pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Close period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
