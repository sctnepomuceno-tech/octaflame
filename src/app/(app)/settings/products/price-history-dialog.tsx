"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { format } from "date-fns";

import { formatCurrency } from "@/lib/volume/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PriceHistoryRow {
  id: string;
  unit_price: number;
  effective_from: string;
  effective_to: string | null;
  changed_by_name: string | null;
}

export function PriceHistoryDialog({ productName, rows }: { productName: string; rows: PriceHistoryRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History /> History
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Price history · {productName}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Changed by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums font-medium">{formatCurrency(r.unit_price)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(r.effective_from), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.effective_to ? format(new Date(r.effective_to), "MMM d, yyyy") : "current"}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.changed_by_name ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  No recorded price changes yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
