"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { recordWarehouseStockIn, recordWarehouseAdjustment } from "@/app/actions/warehouse";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Option {
  id: string;
  name: string;
}

export function WarehouseStockDialog({ items }: { items: Option[] }) {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submitStockIn() {
    if (!itemId) return;
    startTransition(async () => {
      const result = await recordWarehouseStockIn({ itemId, quantity, source: "Fiesta Gas Plant" });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  function submitAdjustment() {
    if (!itemId || !reason) return toast.error("Select an item and give a reason.");
    startTransition(async () => {
      const result = await recordWarehouseAdjustment({ itemId, quantity, direction, reason });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Adjustment recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Record stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record warehouse stock</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="in">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Stock in</TabsTrigger>
            <TabsTrigger value="adjustment">Adjustment</TabsTrigger>
          </TabsList>
          <TabsContent value="in" className="flex flex-col gap-4 pt-4">
            <div className="grid gap-2">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity received</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
            </div>
            <Button onClick={submitStockIn} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Record
            </Button>
          </TabsContent>
          <TabsContent value="adjustment" className="flex flex-col gap-4 pt-4">
            <div className="grid gap-2">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Direction</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Add</SelectItem>
                    <SelectItem value="out">Remove</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why?" />
            </div>
            <Button onClick={submitAdjustment} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Record adjustment
            </Button>
          </TabsContent>
        </Tabs>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
