"use client";

import { createSale } from "@/app/actions/sales";
import type { SaleFormInput } from "@/lib/validation/sales";
import { offlineDb } from "./db";

export interface SubmitSaleOutcome {
  saleId: string | null;
  queued: boolean;
  error?: string;
}

/**
 * Shared by the main sales entry form and route mode (§9.4): try the
 * server action, and if the browser is offline or the request itself
 * fails (flaky signal, not a clean offline state), queue it instead of
 * losing the sale. Never throws.
 */
export async function submitOrQueueSale(
  input: SaleFormInput,
  customerLabel: string,
  totalAmount: number
): Promise<SubmitSaleOutcome> {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (!offline) {
    try {
      const result = await createSale(input);
      if (result.error) {
        return { saleId: null, queued: false, error: result.error };
      }
      return { saleId: result.saleId!, queued: false };
    } catch {
      // fall through to queue
    }
  }

  await offlineDb.addPendingSale({
    clientRef: input.clientRef,
    customerId: input.customerId,
    customerLabel,
    saleDate: input.saleDate,
    deploymentDate: input.deploymentDate,
    paymentStatus: input.paymentStatus,
    amountPaid: input.amountPaid,
    emptiesCollected: input.emptiesCollected,
    cratesReturnedByCustomer: input.cratesReturnedByCustomer,
    notes: input.notes,
    lines: input.lines.map((l) => ({
      productId: l.productId,
      qtyCrates: l.qtyCrates,
      qtyCanisters: l.qtyCanisters,
      qtySets: l.qtySets,
      notes: l.notes,
    })),
    totalAmount,
    status: "pending",
    queuedAt: new Date().toISOString(),
  });

  return { saleId: null, queued: true };
}
