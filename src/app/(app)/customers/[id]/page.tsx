import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCount, formatCurrency, formatKg } from "@/lib/volume";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerStatusBadge } from "../customer-status-badge";
import { EditCustomerButton } from "./edit-customer-button";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyPermission(["customers.read.own", "customers.read.all"]);
  const { id } = await props.params;

  const supabase = await createClient();

  const [{ data: customer }, { data: municipalities }, { data: sales }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("municipalities").select("id, name"),
    supabase
      .from("sales")
      .select("id, sale_date, receipt_no, total_amount, total_volume_kg, payment_status, empties_variance")
      .eq("customer_id", id)
      .order("sale_date", { ascending: false })
      .limit(10),
  ]);

  if (!customer) {
    notFound();
  }

  const municipalityName =
    (municipalities ?? []).find((m) => m.id === customer.municipality_id)?.name ?? "—";

  const emptiesOwed = (sales ?? []).reduce((sum, s) => sum + Math.max(s.empties_variance, 0), 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {customer.business_name || customer.owner_name}
            </h1>
            <Badge variant="secondary">{customer.customer_type}</Badge>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="text-sm text-muted-foreground">{municipalityName}</p>
        </div>
        <EditCustomerButton
          customer={customer}
          municipalities={municipalities ?? []}
        />
      </div>

      {emptiesOwed > 0 ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm">
            ⚠ Owes an estimated <span className="font-semibold tabular-nums">{formatCount(emptiesOwed)}</span> empty shell{emptiesOwed === 1 ? "" : "s"} across recent sales.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div><span className="text-muted-foreground">Owner:</span> {customer.owner_name || "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {customer.contact_number || "—"}</div>
            <div><span className="text-muted-foreground">Barangay:</span> {customer.barangay || "—"}</div>
            <div><span className="text-muted-foreground">Address:</span> {customer.address || "—"}</div>
            <div><span className="text-muted-foreground">Landmark:</span> {customer.landmark || "—"}</div>
            {customer.notes ? (
              <div className="mt-2 rounded-md bg-muted p-2 text-muted-foreground">{customer.notes}</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifetime</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Transactions</div>
              <div className="text-lg font-semibold tabular-nums">{customer.total_transactions}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volume</div>
              <div className="text-lg font-semibold tabular-nums">{formatKg(customer.lifetime_volume_kg)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Amount</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(customer.lifetime_amount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg. purchase</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(customer.average_purchase_amount)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sales ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.sale_date}</TableCell>
                <TableCell>
                  <Link href={`/sales/${s.id}`} className="hover:underline">
                    {s.receipt_no}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{s.payment_status}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(s.total_volume_kg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.total_amount)}</TableCell>
              </TableRow>
            ))}
            {(sales ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
