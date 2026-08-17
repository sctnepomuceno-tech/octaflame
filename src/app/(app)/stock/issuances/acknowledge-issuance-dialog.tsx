"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { acknowledgeStockIssuance } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface IssuanceItem {
  itemId: string;
  itemName: string;
  quantityIssued: number;
}

export function AcknowledgeIssuanceDialog({
  issuanceId,
  issuanceNo,
  items,
}: {
  issuanceId: string;
  issuanceNo: string;
  items: IssuanceItem[];
}) {
  const [open, setOpen] = useState(false);
  const [received, setReceived] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.itemId, i.quantityIssued]))
  );
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await acknowledgeStockIssuance(
        issuanceId,
        items.map((i) => ({ itemId: i.itemId, quantityReceived: received[i.itemId] ?? 0 })),
        disputing ? disputeReason || "Disputed" : undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(disputing ? "Issuance disputed." : "Issuance acknowledged.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Acknowledge</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acknowledge {issuanceNo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between gap-2">
              <Label className="flex-1">
                {item.itemName} <span className="text-muted-foreground">(sent {item.quantityIssued})</span>
              </Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={received[item.itemId] ?? 0}
                onChange={(e) =>
                  setReceived((prev) => ({ ...prev, [item.itemId]: Number(e.target.value) || 0 }))
                }
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={disputing} onChange={(e) => setDisputing(e.target.checked)} />
            Dispute this issuance
          </label>
          {disputing ? (
            <Textarea
              placeholder="What's wrong?"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {disputing ? "Submit dispute" : "Confirm receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
