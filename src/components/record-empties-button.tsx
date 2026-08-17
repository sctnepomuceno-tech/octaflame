"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recordEmptiesCollection } from "@/app/actions/returns";
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

export function RecordEmptiesButton({ customerId, owed }: { customerId: string; owed: number }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(Math.min(owed, 1));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await recordEmptiesCollection({
        customerId,
        itemType: "canister_shell",
        quantity,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Empties collection recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Record collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record empties collected</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Shells collected</Label>
          <Input
            type="number"
            min={1}
            max={owed}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
