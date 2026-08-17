"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { createSaleReturn } from "@/app/actions/returns";
import { formatCount, formatCurrency } from "@/lib/volume/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SaleItemRow {
  id: string;
  productName: string;
  line_canisters: number;
  line_total: number;
  returned: number;
}

const RETURN_TYPES = [
  { value: "damaged", label: "Damaged" },
  { value: "leaking", label: "Leaking" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "customer_return", label: "Customer return" },
  { value: "expired", label: "Expired" },
] as const;

function ReturnDialog({
  saleId,
  item,
  onDone,
}: {
  saleId: string;
  item: SaleItemRow;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [returnType, setReturnType] = useState<(typeof RETURN_TYPES)[number]["value"]>("leaking");
  const [restockable, setRestockable] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [pending, startTransition] = useTransition();
  const remaining = item.line_canisters - item.returned;

  function submit() {
    startTransition(async () => {
      const result = await createSaleReturn({
        saleId,
        saleItemId: item.id,
        quantity,
        returnType,
        restockable,
        refundAmount,
        returnDate: new Date().toISOString().slice(0, 10),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return recorded.");
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={remaining <= 0}>
          <Undo2 /> Return
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return — {item.productName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Quantity (of {remaining} remaining)</Label>
            <Input
              type="number"
              min={1}
              max={remaining}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(remaining, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Select value={returnType} onValueChange={(v) => setReturnType(v as typeof returnType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restockable} onCheckedChange={(v) => setRestockable(v === true)} />
            Restockable (goes back to DSP rolling stock)
          </label>
          <div className="grid gap-2">
            <Label>Refund amount</Label>
            <Input
              type="number"
              min={0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Record return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaleReturnsPanel({
  saleId,
  items,
  canReturn,
}: {
  saleId: string;
  items: SaleItemRow[];
  canReturn: boolean;
}) {
  const router = useRouter();

  if (!canReturn) return null;

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Returns</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <div className="font-medium">{item.productName}</div>
              <div className="text-xs text-muted-foreground">
                {formatCount(item.line_canisters)} sold
                {item.returned > 0 ? ` · ${formatCount(item.returned)} returned` : ""}
                {" · "}
                {formatCurrency(item.line_total)}
              </div>
            </div>
            <ReturnDialog saleId={saleId} item={item} onDone={() => router.refresh()} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export type { SaleItemRow };
