"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getLastOrderLines } from "@/app/actions/sales";
import { submitOrQueueSale } from "@/lib/offline/submit-sale";
import { offlineDb, type CachedCustomer } from "@/lib/offline/db";
import {
  lineCanisters,
  lineVolumeKg,
  sumVolumeKg,
  type VolumeConstants,
} from "@/lib/volume/calculations";
import { formatCurrency, formatCount } from "@/lib/volume/format";
import { CustomerPicker, type SelectedCustomer } from "@/components/customer-picker";
import type { MunicipalityOption } from "@/components/customer-form-dialog";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SalesProduct } from "@/components/sales-entry-form";

interface StopLineState {
  qtyCrates: number;
  qtyCanisters: number;
  qtySets: number;
}

interface Stop {
  id: string;
  clientRef: string;
  customer: SelectedCustomer | null;
  lines: Record<string, StopLineState>;
  status: "idle" | "submitting" | "done" | "queued" | "error";
  error?: string;
}

const EMPTY_LINE: StopLineState = { qtyCrates: 0, qtyCanisters: 0, qtySets: 0 };

function newStop(): Stop {
  return { id: crypto.randomUUID(), clientRef: crypto.randomUUID(), customer: null, lines: {}, status: "idle" };
}

export function RouteModeForm({
  products,
  municipalities,
  volumeConstants,
  defaultMunicipalityId,
  offlineCustomers = [],
}: {
  products: SalesProduct[];
  municipalities: MunicipalityOption[];
  volumeConstants: VolumeConstants;
  defaultMunicipalityId?: string;
  offlineCustomers?: CachedCustomer[];
}) {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([newStop()]);
  const [submittingAll, setSubmittingAll] = useState(false);

  useEffect(() => {
    offlineDb.cacheProducts(products);
    if (offlineCustomers.length > 0) offlineDb.cacheCustomers(offlineCustomers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computeStop(stop: Stop) {
    const computedLines = products
      .map((product) => {
        const state = stop.lines[product.id] ?? EMPTY_LINE;
        const qty = { ...state, canistersIncludedPerSet: product.canisters_included };
        const canisters = lineCanisters(qty, volumeConstants);
        if (canisters === 0) return null;
        const volumeKg = lineVolumeKg(qty, volumeConstants);
        const total =
          product.unit_type === "set"
            ? product.unit_price * state.qtySets
            : product.unit_type === "crate"
              ? product.unit_price * state.qtyCrates
              : product.unit_price * canisters;
        return { product, state, canisters, volumeKg, total };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    return {
      computedLines,
      total: computedLines.reduce((s, l) => s + l.total, 0),
      canisters: computedLines.reduce((s, l) => s + l.canisters, 0),
      volumeKg: sumVolumeKg(computedLines.map((l) => l.volumeKg)),
    };
  }

  const routeTotal = stops.reduce((sum, s) => sum + computeStop(s).total, 0);
  const routeCanisters = stops.reduce((sum, s) => sum + computeStop(s).canisters, 0);

  function updateStop(id: string, patch: Partial<Stop>) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateLine(stopId: string, productId: string, patch: Partial<StopLineState>) {
    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId
          ? { ...s, lines: { ...s.lines, [productId]: { ...(s.lines[productId] ?? EMPTY_LINE), ...patch } } }
          : s
      )
    );
  }

  async function repeatLastOrder(stop: Stop) {
    if (!stop.customer) return;
    const lastLines = await getLastOrderLines(stop.customer.id).catch(() => []);
    if (lastLines.length === 0) {
      toast.info("No previous order found for this customer.");
      return;
    }
    const lines: Record<string, StopLineState> = {};
    for (const l of lastLines) {
      lines[l.productId] = { qtyCrates: l.qtyCrates, qtyCanisters: l.qtyCanisters, qtySets: l.qtySets };
    }
    updateStop(stop.id, { lines });
    toast.success("Pre-filled from their last order.");
  }

  async function submitRoute() {
    const today = new Date().toISOString().slice(0, 10);
    setSubmittingAll(true);

    for (const stop of stops) {
      if (!stop.customer) continue;
      const { computedLines, total } = computeStop(stop);
      if (computedLines.length === 0) continue;

      updateStop(stop.id, { status: "submitting" });

      const outcome = await submitOrQueueSale(
        {
          clientRef: stop.clientRef,
          customerId: stop.customer.id,
          saleDate: today,
          deploymentDate: stop.customer.customerType === "HH" ? undefined : today,
          paymentStatus: "paid",
          amountPaid: total,
          emptiesCollected: 0,
          cratesReturnedByCustomer: 0,
          lines: computedLines.map((l) => ({
            productId: l.product.id,
            qtyCrates: l.state.qtyCrates,
            qtyCanisters: l.state.qtyCanisters,
            qtySets: l.state.qtySets,
          })),
        },
        stop.customer.label,
        total
      );

      updateStop(stop.id, {
        status: outcome.error ? "error" : outcome.queued ? "queued" : "done",
        error: outcome.error,
      });
    }

    setSubmittingAll(false);
    toast.success("Route submitted.");
  }

  const allDone = stops.every((s) => s.status === "done" || s.status === "queued" || !s.customer);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-28 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Route mode</h1>
        <p className="text-sm text-muted-foreground">Encode a full run, one screen, no navigation between stops.</p>
      </div>

      {stops.map((stop, idx) => {
        const { total, canisters } = computeStop(stop);
        return (
          <Card key={stop.id} className="p-4">
            <CardContent className="flex flex-col gap-3 p-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Stop {idx + 1}</span>
                <div className="flex items-center gap-2">
                  {stop.status === "done" ? <span className="text-xs text-success">Saved</span> : null}
                  {stop.status === "queued" ? <span className="text-xs text-warning">Queued</span> : null}
                  {stop.status === "error" ? <span className="text-xs text-destructive">{stop.error}</span> : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setStops((prev) => prev.filter((s) => s.id !== stop.id))}
                    disabled={stops.length === 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomerPicker
                    municipalities={municipalities}
                    defaultMunicipalityId={defaultMunicipalityId}
                    value={stop.customer}
                    onChange={(c) => updateStop(stop.id, { customer: c })}
                  />
                </div>
                {stop.customer ? (
                  <Button variant="outline" size="icon" onClick={() => repeatLastOrder(stop)} aria-label="Repeat last order">
                    <RotateCcw />
                  </Button>
                ) : null}
              </div>

              {stop.customer ? (
                <div className="grid grid-cols-2 gap-2">
                  {products.map((product) => {
                    const isSet = product.unit_type === "set";
                    const isHousehold = stop.customer?.customerType === "HH";
                    const useCrates = !isSet && !isHousehold;
                    const state = stop.lines[product.id] ?? EMPTY_LINE;
                    const qty = isSet ? state.qtySets : useCrates ? state.qtyCrates : state.qtyCanisters;

                    return (
                      <div key={product.id} className="flex flex-col gap-1 rounded-md border p-2">
                        <span className="text-xs font-medium">{product.name}</span>
                        <NumberStepper
                          value={qty}
                          onChange={(v) => {
                            if (isSet) updateLine(stop.id, product.id, { qtySets: v });
                            else if (useCrates) updateLine(stop.id, product.id, { qtyCrates: v });
                            else updateLine(stop.id, product.id, { qtyCanisters: v });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {total > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(total)} · {formatCount(canisters)} canisters
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <Button variant="outline" onClick={() => setStops((prev) => [...prev, newStop()])}>
        <Plus /> Add stop
      </Button>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm tabular-nums">
            <span className="text-base font-semibold">{formatCurrency(routeTotal)}</span>
            <span className="text-muted-foreground">{formatCount(routeCanisters)} canisters</span>
          </div>
          {allDone && stops.some((s) => s.status === "done" || s.status === "queued") ? (
            <Button size="lg" onClick={() => router.push("/sales")}>
              Done
            </Button>
          ) : (
            <Button size="lg" onClick={submitRoute} disabled={submittingAll || routeTotal === 0}>
              {submittingAll ? <Loader2 className="animate-spin" /> : null}
              Submit route
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
