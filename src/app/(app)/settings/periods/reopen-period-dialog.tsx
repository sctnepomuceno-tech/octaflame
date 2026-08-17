"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockOpen } from "lucide-react";
import { toast } from "sonner";

import { reopenPeriod } from "@/app/actions/periods";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ReopenPeriodDialog({ year, month, label }: { year: number; month: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await reopenPeriod(year, month, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} reopened.`);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <LockOpen /> Reopen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen {label}?</DialogTitle>
          <DialogDescription>
            This lets new sales be dated in this month again. A reason is
            required and logged to the audit log (§7.10).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !reason.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Reopen period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
