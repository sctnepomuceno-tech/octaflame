"use client";

import Link from "next/link";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import { useSyncQueue } from "@/hooks/use-sync-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SyncIndicator() {
  const { pendingCount, failedCount, isOnline, syncing, syncNow } = useSyncQueue();

  if (pendingCount === 0 && failedCount === 0 && isOnline) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b bg-warning/5 px-4 py-2 text-sm">
      {!isOnline ? (
        <Badge variant="warning" className="gap-1">
          <WifiOff className="size-3" /> Offline
        </Badge>
      ) : null}
      {pendingCount > 0 ? (
        <span className="text-muted-foreground">
          {pendingCount} sale{pendingCount === 1 ? "" : "s"} pending sync
        </span>
      ) : null}
      {failedCount > 0 ? (
        <Link href="/sync-issues" className="text-destructive underline">
          {failedCount} sync issue{failedCount === 1 ? "" : "s"}
        </Link>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-7"
        onClick={syncNow}
        disabled={syncing || !isOnline}
      >
        {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Sync now
      </Button>
    </div>
  );
}
