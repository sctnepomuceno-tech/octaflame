"use client";

import { offlineDb, type PendingSale, type PendingCustomer } from "./db";
import { syncOfflineCustomer } from "@/app/actions/customers";
import { createSale } from "@/app/actions/sales";
import { customerFormSchema } from "@/lib/validation/customers";

export interface SyncResult {
  syncedCustomers: number;
  syncedSales: number;
  failedCustomers: number;
  failedSales: number;
}

let syncing = false;

/**
 * Sequential sync on reconnect (§9.3): pending customers first (a queued
 * sale may reference one), then pending sales, each reporting its own
 * success or failure — never silently dropped. Safe to call repeatedly;
 * a sync already in flight is skipped rather than run twice.
 */
export async function runSync(): Promise<SyncResult | null> {
  if (syncing) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  syncing = true;
  const result: SyncResult = { syncedCustomers: 0, syncedSales: 0, failedCustomers: 0, failedSales: 0 };

  try {
    const pendingCustomers = await offlineDb.getPendingCustomers();
    for (const customer of pendingCustomers) {
      if (customer.status === "synced") continue;
      await syncCustomer(customer, result);
    }

    const pendingSales = await offlineDb.getPendingSales();
    for (const sale of pendingSales) {
      await syncSale(sale, result);
    }
  } finally {
    syncing = false;
  }

  return result;
}

async function syncCustomer(customer: PendingCustomer, result: SyncResult) {
  const parsed = customerFormSchema.safeParse({
    customerType: customer.customerType,
    businessName: customer.businessName,
    ownerName: customer.ownerName,
    contactNumber: customer.contactNumber,
    municipalityId: customer.municipalityId,
    barangay: customer.barangay,
    address: customer.address,
    landmark: customer.landmark,
    notes: customer.notes,
  });

  if (!parsed.success) {
    customer.status = "failed";
    customer.error = parsed.error.issues[0]?.message ?? "Invalid data.";
    await offlineDb.updatePendingCustomer(customer);
    result.failedCustomers++;
    return;
  }

  try {
    const res = await syncOfflineCustomer(customer.id, parsed.data);
    if (res.error) {
      customer.status = "failed";
      customer.error = res.error;
      await offlineDb.updatePendingCustomer(customer);
      result.failedCustomers++;
      return;
    }
    customer.status = "synced";
    await offlineDb.removePendingCustomer(customer.id);
    result.syncedCustomers++;
  } catch (err) {
    customer.status = "failed";
    customer.error = err instanceof Error ? err.message : "Sync failed.";
    await offlineDb.updatePendingCustomer(customer);
    result.failedCustomers++;
  }
}

async function syncSale(sale: PendingSale, result: SyncResult) {
  if (sale.status === "syncing") return;

  sale.status = "syncing";
  await offlineDb.updatePendingSale(sale);

  try {
    const res = await createSale({
      clientRef: sale.clientRef,
      customerId: sale.customerId,
      saleDate: sale.saleDate,
      deploymentDate: sale.deploymentDate,
      paymentStatus: sale.paymentStatus,
      amountPaid: sale.amountPaid,
      emptiesCollected: sale.emptiesCollected,
      cratesReturnedByCustomer: sale.cratesReturnedByCustomer,
      notes: sale.notes,
      lines: sale.lines,
    });

    if (res.error) {
      sale.status = "failed";
      sale.error = res.error;
      await offlineDb.updatePendingSale(sale);
      result.failedSales++;
      return;
    }

    // create_sale is idempotent on client_ref regardless of was_duplicate —
    // either way this queue entry is done.
    await offlineDb.removePendingSale(sale.clientRef);
    result.syncedSales++;
  } catch (err) {
    sale.status = "failed";
    sale.error = err instanceof Error ? err.message : "Sync failed — will retry.";
    await offlineDb.updatePendingSale(sale);
    result.failedSales++;
  }
}
