import type { Metadata } from "next";
import Link from "next/link";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatKg } from "@/lib/volume";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Sales" };

const PAGE_SIZE = 50;

const PAYMENT_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  paid: "success",
  partial: "warning",
  unpaid: "destructive",
};

export default async function SalesPage() {
  await requireAnyPermission(["sales.read.own", "sales.read.all"]);

  const supabase = await createClient();

  const [{ data: sales }, { data: customers }, { data: municipalities }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_date, receipt_no, customer_id, municipality_id, payment_status, total_amount, total_volume_kg, notes")
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from("customers").select("id, business_name, owner_name"),
    supabase.from("municipalities").select("id, name"),
  ]);

  const customerLabelById = new Map(
    (customers ?? []).map((c) => [c.id, c.business_name || c.owner_name || "Customer"])
  );
  const municipalityNameById = new Map((municipalities ?? []).map((m) => [m.id, m.name]));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">{(sales ?? []).length} shown</p>
        </div>
        <Button asChild>
          <Link href="/sales/new">New sale</Link>
        </Button>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Municipality</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sales ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap">{s.sale_date}</TableCell>
                <TableCell>
                  <Link href={`/sales/${s.id}`} className="font-medium hover:underline">
                    {s.receipt_no}
                  </Link>
                  {s.notes ? <span className="ml-1.5 text-muted-foreground">•</span> : null}
                </TableCell>
                <TableCell>{customerLabelById.get(s.customer_id) ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {municipalityNameById.get(s.municipality_id) ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={PAYMENT_VARIANT[s.payment_status]} className="capitalize">
                    {s.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(s.total_volume_kg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.total_amount)}</TableCell>
              </TableRow>
            ))}
            {(sales ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No sales yet.{" "}
                  <Link href="/sales/new" className="underline">
                    Record the first one
                  </Link>
                  .
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards (§16.2) */}
      <div className="flex flex-col gap-2 md:hidden">
        {(sales ?? []).map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`}>
            <Card className="p-4">
              <CardContent className="flex flex-col gap-1 p-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{customerLabelById.get(s.customer_id) ?? "—"}</span>
                  <Badge variant={PAYMENT_VARIANT[s.payment_status]} className="capitalize">
                    {s.payment_status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{s.sale_date}</span>
                  <span>{s.receipt_no}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums text-muted-foreground">{formatKg(s.total_volume_kg)}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(s.total_amount)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(sales ?? []).length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No sales yet.{" "}
            <Link href="/sales/new" className="underline">
              Record the first one
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
