"use client";

import { useCallback, useEffect, useState } from "react";

import { offlineDb, QUEUE_CHANGED_EVENT } from "@/lib/offline/db";
import { runSync } from "@/lib/offline/sync";

export interface SyncQueueState {
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  syncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

export function useSyncQueue(): SyncQueueState {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [sales, customers] = await Promise.all([
      offlineDb.getPendingSales(),
      offlineDb.getPendingCustomers(),
    ]);
    const all = [...sales, ...customers];
    setPendingCount(all.filter((x) => x.status === "pending" || x.status === "syncing").length);
    setFailedCount(all.filter((x) => x.status === "failed").length);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await runSync();
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refresh();

    const onOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const onOffline = () => setIsOnline(false);
    const onQueueChanged = () => refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pendingCount, failedCount, isOnline, syncing, refresh, syncNow };
}
