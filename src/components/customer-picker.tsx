"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";

import { searchCustomers, type CustomerSearchResult } from "@/app/actions/sales";
import { CustomerFormDialog, type MunicipalityOption } from "@/components/customer-form-dialog";
import { offlineDb } from "@/lib/offline/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SelectedCustomer {
  id: string;
  label: string;
  customerType: "HH" | "RTL" | "WS";
  municipalityId: string;
}

interface CustomerPickerProps {
  municipalities: MunicipalityOption[];
  defaultMunicipalityId?: string;
  value: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
}

function searchCached(customers: CustomerSearchResult[], query: string) {
  if (!query.trim()) return customers.slice(0, 10);
  const q = query.toLowerCase();
  return customers
    .filter(
      (c) =>
        c.business_name?.toLowerCase().includes(q) || c.owner_name?.toLowerCase().includes(q)
    )
    .slice(0, 10);
}

export function CustomerPicker({
  municipalities,
  defaultMunicipalityId,
  value,
  onChange,
}: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cached = await offlineDb.getCachedCustomers();
          setResults(
            searchCached(
              cached.map((c) => ({ ...c, latest_purchase_date: null })),
              query
            )
          );
          return;
        }
        try {
          const data = await searchCustomers(query);
          setResults(data);
        } catch {
          const cached = await offlineDb.getCachedCustomers();
          setResults(
            searchCached(
              cached.map((c) => ({ ...c, latest_purchase_date: null })),
              query
            )
          );
        }
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function select(customer: CustomerSearchResult) {
    onChange({
      id: customer.id,
      label: customer.business_name || customer.owner_name || "Customer",
      customerType: customer.customer_type,
      municipalityId: customer.municipality_id,
    });
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="font-medium">{value.label}</div>
          <div className="flex gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{value.customerType}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Change customer">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customer…"
          className="h-11 pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          <div className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {query ? "No matches." : "Recent customers will appear here."}
              </p>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                  )}
                >
                  <span>{c.business_name || c.owner_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.customer_type}</Badge>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-1">
            <CustomerFormDialog
              municipalities={municipalities}
              defaultMunicipalityId={defaultMunicipalityId}
              allowOffline
              trigger={
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  + New customer
                </Button>
              }
              onCreated={(customer) => {
                onChange({
                  id: customer.id,
                  label: customer.label,
                  customerType: customer.customerType,
                  municipalityId: customer.municipalityId,
                });
                setOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
