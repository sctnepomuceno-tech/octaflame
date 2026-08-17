"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_MS = 60_000;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [checkedSchedule, setCheckedSchedule] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setNotifications(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // Date/threshold-based rules have no trigger event to hang off (§13) —
    // opportunistically evaluate them once per app session instead.
    if (checkedSchedule) return;
    setCheckedSchedule(true);
    const supabase = createClient();
    supabase.rpc("run_scheduled_notification_checks").then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedSchedule]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markRead(id: string, link: string | null) {
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    if (link) router.push(link);
  }

  async function markAllRead() {
    const supabase = createClient();
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} className="text-xs font-normal text-muted-foreground hover:underline">
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => markRead(n.id, n.link)}
                className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
              >
                <span className={n.read_at ? "text-sm text-muted-foreground" : "text-sm font-medium"}>{n.title}</span>
                {n.body ? <span className="text-xs text-muted-foreground">{n.body}</span> : null}
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
