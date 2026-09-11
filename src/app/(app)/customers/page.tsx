import type { Metadata } from "next";
import Link from "next/link";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatKg } from "@/lib/volume";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import type { CustomerStatus, CustomerType } from "@/lib/supabase/database.types";
import { CustomerFilters } from "./customer-filters";
import { CustomerStatusBadge } from "./customer-status-badge";

export const metadata: Metadata = { title: "Customers" };

const CUSTOMER_TYPES: CustomerType[] = ["HH", "RTL", "WS", "SD"];
const CUSTOMER_STATUSES: CustomerStatus[] = [
  "prospect",
  "newly_acquired",
  "active",
  "dormant",
  "inactive",
];
const SORTS = [
  "recent",
  "volume_desc",
  "volume_asc",
  "amount_desc",
  "amount_asc",
  "transactions_desc",
  "name_asc",
] as const;

export default async function CustomersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAnyPermission(["customers.read.own", "customers.read.all"]);
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const typeParam = typeof params.type === "string" ? params.type : "all";
  const statusParam = typeof params.status === "string" ? params.status : "all";
  const type = CUSTOMER_TYPES.find((t) => t === typeParam);
  const status = CUSTOMER_STATUSES.find((s) => s === statusParam);
  const sortParam = typeof params.sort === "string" ? params.sort : "recent";
  const sort = SORTS.find((s) => s === sortParam) ?? "recent";
  const municipalityParam = typeof params.municipality === "string" ? params.municipality : "all";

  const supabase = await createClient();

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, dsp_id")
    .eq("active", true)
    .order("name");

  const municipality = (municipalities ?? []).find((m) => m.id === municipalityParam)?.id;

  let query = supabase
    .from("customers")
    .select(
      "id, business_name, owner_name, customer_type, status, municipality_id, total_transactions, lifetime_volume_kg, lifetime_amount, notes"
    )
    .limit(1000);

  if (sort === "volume_desc") {
    query = query.order("lifetime_volume_kg", { ascending: false });
  } else if (sort === "volume_asc") {
    query = query.order("lifetime_volume_kg", { ascending: true });
  } else if (sort === "amount_desc") {
    query = query.order("lifetime_amount", { ascending: false });
  } else if (sort === "amount_asc") {
    query = query.order("lifetime_amount", { ascending: true });
  } else if (sort === "transactions_desc") {
    query = query.order("total_transactions", { ascending: false });
  } else if (sort === "name_asc") {
    query = query.order("business_name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (q) {
    query = query.or(`business_name.ilike.%${q}%,owner_name.ilike.%${q}%`);
  }
  if (type) {
    query = query.eq("customer_type", type);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (municipality) {
    query = query.eq("municipality_id", municipality);
  }

  const { data: customers } = await query;

  const municipalityNameById = new Map((municipalities ?? []).map((m) => [m.id, m.name]));
  const defaultMunicipalityId =
    profile.role === "dsp"
      ? (municipalities ?? []).find((m) => m.dsp_id === profile.dsp_id)?.id
      : undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {(customers ?? []).length} shown
          </p>
        </div>
        <CustomerFormDialog
          municipalities={municipalities ?? []}
          defaultMunicipalityId={defaultMunicipalityId}
        />
      </div>

      <CustomerFilters municipalities={municipalities ?? []} />

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Municipality</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Lifetime volume</TableHead>
              <TableHead className="text-right">Lifetime amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(customers ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.business_name || c.owner_name}
                    {c.notes ? <span className="ml-1.5 text-muted-foreground">•</span> : null}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.customer_type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {municipalityNameById.get(c.municipality_id) ?? "—"}
                </TableCell>
                <TableCell>
                  <CustomerStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.total_transactions}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKg(c.lifetime_volume_kg)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.lifetime_amount)}</TableCell>
              </TableRow>
            ))}
            {(customers ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No customers yet. Add the first one to get started.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards (§16.2) */}
      <div className="flex flex-col gap-2 md:hidden">
        {(customers ?? []).map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`}>
            <Card className="p-4">
              <CardContent className="flex flex-col gap-1 p-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.business_name || c.owner_name}</span>
                  <Badge variant="secondary">{c.customer_type}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{municipalityNameById.get(c.municipality_id) ?? "—"}</span>
                  <CustomerStatusBadge status={c.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {c.total_transactions} txns
                  </span>
                  <span className="tabular-nums font-medium">{formatCurrency(c.lifetime_amount)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(customers ?? []).length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No customers yet. Add the first one to get started.
          </p>
        ) : null}
      </div>
    </div>
  );
}
