"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { offlineDb, QUEUE_CHANGED_EVENT, type PendingSale, type PendingCustomer } from "@/lib/offline/db";
import { runSync } from "@/lib/offline/sync";
import { formatCurrency } from "@/lib/volume/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SyncIssuesPage() {
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [customers, setCustomers] = useState<PendingCustomer[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const [s, c] = await Promise.all([offlineDb.getPendingSales(), offlineDb.getPendingCustomers()]);
    setSales(s);
    setCustomers(c);
  }

  useEffect(() => {
    load();
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, load);
  }, []);

  async function retryAll() {
    setSyncing(true);
    try {
      const result = await runSync();
      if (result) {
        if (result.syncedSales + result.syncedCustomers > 0) {
          toast.success(`Synced ${result.syncedSales + result.syncedCustomers} item(s).`);
        }
        if (result.failedSales + result.failedCustomers > 0) {
          toast.error(`${result.failedSales + result.failedCustomers} still failing.`);
        }
      } else {
        toast.error("Can't sync while offline.");
      }
    } finally {
      setSyncing(false);
      load();
    }
  }

  async function discardSale(clientRef: string) {
    await offlineDb.removePendingSale(clientRef);
    load();
  }

  const failedSales = sales.filter((s) => s.status === "failed");
  const pendingSales = sales.filter((s) => s.status !== "failed");
  const failedCustomers = customers.filter((c) => c.status === "failed");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sync issues</h1>
          <p className="text-sm text-muted-foreground">
            Nothing queued offline is ever silently dropped (§9.3).
          </p>
        </div>
        <Button onClick={retryAll} disabled={syncing}>
          {syncing ? <Loader2 className="animate-spin" /> : <RotateCw />}
          Retry all
        </Button>
      </div>

      {failedSales.length === 0 && failedCustomers.length === 0 && pendingSales.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing queued. Everything is synced.
          </CardContent>
        </Card>
      ) : null}

      {failedCustomers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {failedCustomers.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{c.businessName || c.ownerName}</div>
                  <div className="text-xs text-destructive">{c.error}</div>
                </div>
                <Badge variant="destructive">Failed</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {sales.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {sales.map((s) => (
              <div key={s.clientRef} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{s.customerLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.saleDate} · {formatCurrency(s.totalAmount)}
                  </div>
                  {s.error ? <div className="text-xs text-destructive">{s.error}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "failed" ? "destructive" : "warning"} className="capitalize">
                    {s.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => discardSale(s.clientRef)} aria-label="Discard">
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
