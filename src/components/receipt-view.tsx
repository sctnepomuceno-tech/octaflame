"use client";

import { useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { formatCount, formatCurrency, formatKg } from "@/lib/volume/format";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Sale = Database["public"]["Tables"]["sales"]["Row"];

interface ReceiptItem {
  id: string;
  productName: string;
  qty_crates: number;
  qty_canisters: number;
  qty_sets: number;
  unit_price: number;
  line_total: number;
  line_canisters: number;
  notes: string | null;
}

export function ReceiptView({
  sale,
  items,
  customerName,
  customerAddress,
  customerContact,
  dspName,
  municipalityName,
}: {
  sale: Sale;
  items: ReceiptItem[];
  customerName: string;
  customerAddress: string | null;
  customerContact: string | null;
  dspName: string;
  municipalityName: string;
}) {
  const [sharing, setSharing] = useState(false);

  async function downloadPdf() {
    window.open(`/api/receipts/${sale.id}/pdf`, "_blank");
  }

  async function share() {
    setSharing(true);
    try {
      const res = await fetch(`/api/receipts/${sale.id}/pdf`);
      const blob = await res.blob();
      const file = new File([blob], `${sale.receipt_no}.pdf`, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt ${sale.receipt_no}`,
          text: `Octaflame receipt ${sale.receipt_no} — ${formatCurrency(sale.total_amount)}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sale.receipt_no}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("Couldn't share the receipt.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-xl font-semibold tracking-tight">Receipt {sale.receipt_no}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download /> PDF
          </Button>
          <Button size="sm" onClick={share} disabled={sharing}>
            <Share2 /> Share
          </Button>
        </div>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold">Octaflame</div>
              <div className="text-sm text-muted-foreground">Fiesta Gas Distributor · Sorsogon</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{sale.receipt_no}</div>
              <div className="text-muted-foreground">{sale.sale_date}</div>
              <div className="text-muted-foreground">{dspName}</div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Customer</div>
              <div className="font-medium">{customerName}</div>
              {customerContact ? <div>{customerContact}</div> : null}
              {customerAddress ? <div className="text-muted-foreground">{customerAddress}</div> : null}
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Municipality</div>
              <div className="font-medium">{municipalityName}</div>
            </div>
          </div>

          <Separator />

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-normal">Item</th>
                <th className="pb-2 font-normal text-right">Qty</th>
                <th className="pb-2 font-normal text-right">Price</th>
                <th className="pb-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qtyLabel =
                  item.qty_sets > 0
                    ? `${item.qty_sets} set${item.qty_sets === 1 ? "" : "s"}`
                    : item.qty_crates > 0
                      ? `${item.qty_crates} crate${item.qty_crates === 1 ? "" : "s"}`
                      : `${item.qty_canisters}`;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-2">
                      {item.productName}
                      {item.notes ? (
                        <div className="text-xs text-muted-foreground">{item.notes}</div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">{qtyLabel}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(item.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Separator />

          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex w-48 justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="tabular-nums">{formatKg(sale.total_volume_kg)}</span>
            </div>
            <div className="flex w-48 justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(sale.total_amount)}</span>
            </div>
          </div>

          {sale.empties_expected > 0 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empties collected</span>
                  <span className="tabular-nums">{formatCount(sale.empties_collected)}</span>
                </div>
                {sale.empties_variance > 0 ? (
                  <div className="flex justify-between text-warning-foreground">
                    <span>Still owed</span>
                    <span className="tabular-nums">{formatCount(sale.empties_variance)}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between">
            <Badge variant={sale.payment_status === "paid" ? "success" : sale.payment_status === "partial" ? "warning" : "destructive"} className="capitalize">
              {sale.payment_status}
            </Badge>
            {sale.notes ? <span className="text-xs text-muted-foreground">{sale.notes}</span> : null}
          </div>

          <div className="mt-8 flex justify-end">
            <div className="w-48 border-t pt-1 text-center text-xs text-muted-foreground">
              Customer signature
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
