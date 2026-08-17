"use client";

/**
 * Minimal IndexedDB wrapper for the offline sales queue (§9.3). No new
 * dependency — the native API is small enough for the four stores this
 * needs. A single `localStorage` draft isn't enough for a DSP doing eight
 * stops with no signal, hence IndexedDB, not localStorage.
 */

const DB_NAME = "octaflame-offline";
const DB_VERSION = 1;

export const STORES = {
  pendingSales: "pendingSales",
  pendingCustomers: "pendingCustomers",
  cachedCustomers: "cachedCustomers",
  cachedProducts: "cachedProducts",
} as const;

export interface PendingSale {
  clientRef: string;
  customerId: string;
  customerLabel: string;
  saleDate: string;
  deploymentDate?: string;
  paymentStatus: "paid" | "partial" | "unpaid";
  amountPaid: number;
  emptiesCollected: number;
  cratesReturnedByCustomer: number;
  notes?: string;
  lines: {
    productId: string;
    qtyCrates: number;
    qtyCanisters: number;
    qtySets: number;
    notes?: string;
  }[];
  totalAmount: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
  queuedAt: string;
}

export interface PendingCustomer {
  id: string;
  businessName?: string;
  ownerName?: string;
  contactNumber?: string;
  customerType: "HH" | "RTL" | "WS";
  municipalityId: string;
  barangay?: string;
  address?: string;
  landmark?: string;
  notes?: string;
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
  queuedAt: string;
}

export interface CachedCustomer {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  customer_type: "HH" | "RTL" | "WS";
  municipality_id: string;
}

export interface CachedProduct {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  unit_type: "canister" | "crate" | "set";
  canisters_included: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.pendingSales)) {
        db.createObjectStore(STORES.pendingSales, { keyPath: "clientRef" });
      }
      if (!db.objectStoreNames.contains(STORES.pendingCustomers)) {
        db.createObjectStore(STORES.pendingCustomers, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.cachedCustomers)) {
        db.createObjectStore(STORES.cachedCustomers, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.cachedProducts)) {
        db.createObjectStore(STORES.cachedProducts, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    tx.oncomplete = () => resolve(request ? request.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll());
}

export const QUEUE_CHANGED_EVENT = "octaflame:sync-queue-changed";

function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

export const offlineDb = {
  async addPendingSale(sale: PendingSale) {
    await withStore(STORES.pendingSales, "readwrite", (store) => store.put(sale));
    notifyQueueChanged();
  },
  async getPendingSales(): Promise<PendingSale[]> {
    return getAllFromStore<PendingSale>(STORES.pendingSales);
  },
  async updatePendingSale(sale: PendingSale) {
    await withStore(STORES.pendingSales, "readwrite", (store) => store.put(sale));
    notifyQueueChanged();
  },
  async removePendingSale(clientRef: string) {
    await withStore(STORES.pendingSales, "readwrite", (store) => store.delete(clientRef));
    notifyQueueChanged();
  },

  async addPendingCustomer(customer: PendingCustomer) {
    await withStore(STORES.pendingCustomers, "readwrite", (store) => store.put(customer));
    notifyQueueChanged();
  },
  async getPendingCustomers(): Promise<PendingCustomer[]> {
    return getAllFromStore<PendingCustomer>(STORES.pendingCustomers);
  },
  async updatePendingCustomer(customer: PendingCustomer) {
    await withStore(STORES.pendingCustomers, "readwrite", (store) => store.put(customer));
    notifyQueueChanged();
  },
  async removePendingCustomer(id: string) {
    await withStore(STORES.pendingCustomers, "readwrite", (store) => store.delete(id));
    notifyQueueChanged();
  },

  async cacheCustomers(customers: CachedCustomer[]) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.cachedCustomers, "readwrite");
      const store = tx.objectStore(STORES.cachedCustomers);
      for (const c of customers) store.put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async getCachedCustomers(): Promise<CachedCustomer[]> {
    return getAllFromStore<CachedCustomer>(STORES.cachedCustomers);
  },

  async cacheProducts(products: CachedProduct[]) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.cachedProducts, "readwrite");
      const store = tx.objectStore(STORES.cachedProducts);
      for (const p of products) store.put(p);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async getCachedProducts(): Promise<CachedProduct[]> {
    return getAllFromStore<CachedProduct>(STORES.cachedProducts);
  },
};
