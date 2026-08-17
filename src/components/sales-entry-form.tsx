"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, MessageSquarePlus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { createSale, checkRecentSimilarSales, getCustomerSalesContext, type CustomerSalesContext } from "@/app/actions/sales";
import {
  lineCanisters,
  lineVolumeKg,
  sumVolumeKg,
  kgToMt,
  crateCanisterEquivalent,
  type VolumeConstants,
} from "@/lib/volume/calculations";
import { formatCurrency, formatKg, formatMt, formatCount } from "@/lib/volume/format";
import { CustomerPicker, type SelectedCustomer } from "@/components/customer-picker";
import type { MunicipalityOption } from "@/components/customer-form-dialog";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface SalesProduct {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  unit_type: "canister" | "crate" | "set";
  canisters_included: number;
}

interface LineState {
  qtyCrates: number;
  qtyCanisters: number;
  qtySets: number;
  notes: string;
  noteOpen: boolean;
}

const EMPTY_LINE: LineState = { qtyCrates: 0, qtyCanisters: 0, qtySets: 0, notes: "", noteOpen: false };

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

export function SalesEntryForm({
  products,
  municipalities,
  volumeConstants,
  defaultMunicipalityId,
}: {
  products: SalesProduct[];
  municipalities: MunicipalityOption[];
  volumeConstants: VolumeConstants;
  defaultMunicipalityId?: string;
}) {
  const router = useRouter();
  const [clientRef] = useState(() => crypto.randomUUID());

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerSalesContext | null>(null);

  const [saleDate, setSaleDate] = useState(today());
  const [deploymentDate, setDeploymentDate] = useState(today());
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [emptiesCollected, setEmptiesCollected] = useState(0);
  const [emptiesTouched, setEmptiesTouched] = useState(false);
  const [cratesReturned, setCratesReturned] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState<{ label: string } | null>(null);
  const [saved, setSaved] = useState<{ saleId: string; receiptNo?: string } | null>(null);

  async function onSelectCustomer(next: SelectedCustomer | null) {
    setCustomer(next);
    setCustomerContext(null);
    if (next) {
      const ctx = await getCustomerSalesContext(next.id);
      setCustomerContext(ctx);
    }
  }

  function updateLine(productId: string, patch: Partial<LineState>) {
    setLines((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? EMPTY_LINE), ...patch },
    }));
  }

  const isHousehold = customer?.customerType === "HH";

  const computedLines = useMemo(() => {
    return products
      .map((product) => {
        const state = lines[product.id] ?? EMPTY_LINE;
        const qty = {
          qtyCrates: state.qtyCrates,
          qtyCanisters: state.qtyCanisters,
          qtySets: state.qtySets,
          canistersIncludedPerSet: product.canisters_included,
        };
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
  }, [products, lines, volumeConstants]);

  const totalAmount = computedLines.reduce((sum, l) => sum + l.total, 0);
  const totalCanisters = computedLines.reduce((sum, l) => sum + l.canisters, 0);
  const totalVolumeKg = sumVolumeKg(computedLines.map((l) => l.volumeKg));

  const refillLine = computedLines.find((l) => l.product.code === "REFILL");
  const emptiesExpected = refillLine?.canisters ?? 0;
  const effectiveEmptiesCollected = emptiesTouched ? emptiesCollected : emptiesExpected;
  const emptiesShortfall = Math.max(emptiesExpected - effectiveEmptiesCollected, 0);

  const effectiveAmountPaid = amountPaidTouched
    ? amountPaid
    : paymentStatus === "paid"
      ? totalAmount
      : 0;

  const canSubmit = customer && computedLines.length > 0 && !submitting;

  async function doSubmit(skipDuplicateCheck = false) {
    if (!customer) return;

    if (!skipDuplicateCheck) {
      const similar = await checkRecentSimilarSales(customer.id, totalAmount);
      if (similar.length > 0) {
        setConfirmDuplicate({ label: customer.label });
        return;
      }
    }

    setSubmitting(true);
    const result = await createSale({
      clientRef,
      customerId: customer.id,
      saleDate,
      deploymentDate: isHousehold ? undefined : deploymentDate,
      paymentStatus,
      amountPaid: effectiveAmountPaid,
      emptiesCollected: effectiveEmptiesCollected,
      cratesReturnedByCustomer: cratesReturned,
      notes: notes || undefined,
      lines: computedLines.map((l) => ({
        productId: l.product.id,
        qtyCrates: l.state.qtyCrates,
        qtyCanisters: l.state.qtyCanisters,
        qtySets: l.state.qtySets,
        notes: l.state.notes || undefined,
      })),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSaved({ saleId: result.saleId! });
  }

  function resetForNewSale(keepCustomer: boolean) {
    setSaved(null);
    setLines({});
    setEmptiesCollected(0);
    setEmptiesTouched(false);
    setCratesReturned(0);
    setAmountPaidTouched(false);
    setNotes("");
    setSaleDate(today());
    setDeploymentDate(today());
    if (!keepCustomer) {
      setCustomer(null);
      setCustomerContext(null);
    }
    router.refresh();
    window.location.reload(); // simplest way to get a fresh clientRef for the next sale
  }

  if (saved) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success text-2xl">
          ✓
        </div>
        <h2 className="text-lg font-semibold">Sale recorded</h2>
        <p className="text-muted-foreground">{formatCurrency(totalAmount)} · {formatKg(totalVolumeKg)}</p>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => resetForNewSale(true)}>Log another sale in this municipality</Button>
          <Button variant="outline" onClick={() => router.push(`/sales/${saved.saleId}`)}>
            Send receipt
          </Button>
          <Button variant="ghost" onClick={() => router.push("/sales")}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-32 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Date</Label>
          <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="h-11" />
        </div>
        <div className="grid gap-2">
          <Label>Customer</Label>
          <CustomerPicker
            municipalities={municipalities}
            defaultMunicipalityId={defaultMunicipalityId}
            value={customer}
            onChange={onSelectCustomer}
          />
        </div>
      </div>

      {customer ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{customer.customerType}</Badge>
          {customerContext?.isRepeatCustomer ? (
            <Badge variant="outline">
              Repeat customer · {customerContext.totalTransactions} purchases · lifetime {formatCount(customerContext.lifetimeCanisters)} canisters
            </Badge>
          ) : null}
          {customerContext && customerContext.emptiesOwed > 0 ? (
            <Badge variant="warning">⚠ Owes {formatCount(customerContext.emptiesOwed)} shells</Badge>
          ) : null}
        </div>
      ) : null}

      {customer && !isHousehold ? (
        <div className="grid gap-2 sm:max-w-xs">
          <Label>Deployment date</Label>
          <Input
            type="date"
            value={deploymentDate}
            onChange={(e) => setDeploymentDate(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">When stocks were physically handed over.</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Label>Products</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((product) => {
            const state = lines[product.id] ?? EMPTY_LINE;
            const isSet = product.unit_type === "set";
            const useCrates = !isSet && !isHousehold && customer !== null;
            const qty = isSet ? state.qtySets : useCrates ? state.qtyCrates : state.qtyCanisters;
            const active = qty > 0;

            return (
              <Card key={product.id} className={cn("p-4", active && "border-primary")}>
                <CardContent className="flex flex-col gap-3 p-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(product.unit_price)} / {isSet ? "set" : "canister"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateLine(product.id, { noteOpen: !state.noteOpen })}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Add note"
                    >
                      <MessageSquarePlus className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isSet ? "Sets" : useCrates ? "Crates" : "Canisters"}
                    </span>
                    <NumberStepper
                      value={qty}
                      onChange={(v) => {
                        if (isSet) updateLine(product.id, { qtySets: v });
                        else if (useCrates) updateLine(product.id, { qtyCrates: v });
                        else updateLine(product.id, { qtyCanisters: v });
                      }}
                    />
                  </div>
                  {useCrates && state.qtyCrates > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      = {formatCount(crateCanisterEquivalent(state.qtyCrates, volumeConstants))} canisters
                    </p>
                  ) : null}
                  {state.noteOpen ? (
                    <Textarea
                      placeholder="Line note…"
                      rows={2}
                      value={state.notes}
                      onChange={(e) => updateLine(product.id, { notes: e.target.value })}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {emptiesExpected > 0 ? (
        <Card className="p-4">
          <CardContent className="flex flex-col gap-2 p-0">
            <Label>Empties collected</Label>
            <NumberStepper
              value={effectiveEmptiesCollected}
              onChange={(v) => {
                setEmptiesTouched(true);
                setEmptiesCollected(v);
              }}
            />
            {emptiesShortfall > 0 ? (
              <p className="text-sm text-warning-foreground">
                Customer will owe {formatCount(emptiesShortfall)} shell{emptiesShortfall === 1 ? "" : "s"}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">All empties accounted for.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-2 sm:max-w-xs">
        <Label>Crates returned by customer</Label>
        <NumberStepper value={cratesReturned} onChange={setCratesReturned} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Payment status</Label>
          <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as typeof paymentStatus)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Amount paid</Label>
          <Input
            type="number"
            min={0}
            className="h-11"
            value={effectiveAmountPaid}
            onChange={(e) => {
              setAmountPaidTouched(true);
              setAmountPaid(Number(e.target.value) || 0);
            }}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Sticky summary bar (§9.1 #8) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm tabular-nums">
            <span className="font-semibold text-base">{formatCurrency(totalAmount)}</span>
            <span className="text-muted-foreground">{formatCount(totalCanisters)} canisters</span>
            <span className="hidden text-muted-foreground sm:inline">{formatKg(totalVolumeKg)} · {formatMt(kgToMt(totalVolumeKg))}</span>
          </div>
          <Button size="lg" disabled={!canSubmit} onClick={() => doSubmit()}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save sale
          </Button>
        </div>
      </div>

      <Dialog open={!!confirmDuplicate} onOpenChange={(open) => !open && setConfirmDuplicate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="text-warning" /> Possible duplicate
            </DialogTitle>
            <DialogDescription>
              A sale for {confirmDuplicate?.label} with the same total was recorded in the last 10
              minutes. Submit this one anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDuplicate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmDuplicate(null);
                doSubmit(true);
              }}
            >
              Submit anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
