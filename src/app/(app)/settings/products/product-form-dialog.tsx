"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createProduct, updateProduct } from "@/app/actions/products";
import { type ProductFormInput } from "@/lib/validation/products";
import { Button } from "@/components/ui/button";
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

export interface EditableProduct {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  unit_type: "canister" | "crate" | "set";
  canisters_included: number;
  includes_stove: boolean;
  stove_count: number;
  sort_order: number;
}

const EMPTY: ProductFormInput = {
  code: "",
  name: "",
  unitPrice: 0,
  unitType: "canister",
  canistersIncluded: 1,
  includesStove: false,
  stoveCount: 0,
  sortOrder: 0,
};

export function ProductFormDialog({ product }: { product?: EditableProduct }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductFormInput>(
    product
      ? {
          code: product.code,
          name: product.name,
          unitPrice: product.unit_price,
          unitType: product.unit_type,
          canistersIncluded: product.canisters_included,
          includesStove: product.includes_stove,
          stoveCount: product.stove_count,
          sortOrder: product.sort_order,
        }
      : EMPTY
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const priceChanged = product ? form.unitPrice !== product.unit_price : false;

  function submit() {
    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, form)
        : await createProduct(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(product ? "Product updated." : "Product created.");
      setOpen(false);
      if (!product) setForm(EMPTY);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button>
            <Plus /> New product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "New product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Code</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>Unit price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: Number(e.target.value) || 0 }))}
            />
            {priceChanged ? (
              <p className="text-xs text-warning">
                This closes out the current price_history row and starts a new one, effective now.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Unit type</Label>
            <Select
              value={form.unitType}
              onValueChange={(v) => setForm((f) => ({ ...f, unitType: v as ProductFormInput["unitType"] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="canister">Canister</SelectItem>
                <SelectItem value="crate">Crate</SelectItem>
                <SelectItem value="set">Set</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Canisters included</Label>
            <Input
              type="number"
              min={0}
              value={form.canistersIncluded}
              onChange={(e) => setForm((f) => ({ ...f, canistersIncluded: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.includesStove}
              onCheckedChange={(v) => setForm((f) => ({ ...f, includesStove: v === true }))}
            />
            Includes a stove
          </label>
          {form.includesStove ? (
            <div className="grid gap-2">
              <Label>Stove count</Label>
              <Input
                type="number"
                min={0}
                value={form.stoveCount}
                onChange={(e) => setForm((f) => ({ ...f, stoveCount: Number(e.target.value) || 0 }))}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
