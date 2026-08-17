"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createStockIssuance } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Option {
  id: string;
  name: string;
}

interface Row {
  itemId: string;
  quantity: number;
}

export function NewIssuanceDialog({ dsps, items }: { dsps: Option[]; items: Option[] }) {
  const [open, setOpen] = useState(false);
  const [dspId, setDspId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ itemId: "", quantity: 1 }]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const validRows = rows.filter((r) => r.itemId && r.quantity > 0);
    if (!dspId || validRows.length === 0) {
      toast.error("Select a DSP and at least one item.");
      return;
    }
    startTransition(async () => {
      const result = await createStockIssuance(
        dspId,
        new Date().toISOString().slice(0, 10),
        undefined,
        validRows.map((r) => ({ itemId: r.itemId, quantityIssued: r.quantity }))
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Issuance created.");
      setOpen(false);
      setRows([{ itemId: "", quantity: 1 }]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New issuance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New stock issuance</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>DSP</Label>
            <Select value={dspId} onValueChange={setDspId}>
              <SelectTrigger>
                <SelectValue placeholder="Select DSP" />
              </SelectTrigger>
              <SelectContent>
                {dsps.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Items</Label>
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={row.itemId}
                  onValueChange={(v) =>
                    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemId: v } : r)))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={row.quantity}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, quantity: Number(e.target.value) || 1 } : r))
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={rows.length === 1}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRows((prev) => [...prev, { itemId: "", quantity: 1 }])}
            >
              <Plus /> Add item
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Create issuance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
