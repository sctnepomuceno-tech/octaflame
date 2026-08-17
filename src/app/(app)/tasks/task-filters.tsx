"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  { value: "open", label: "Open (pending + in progress)" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITIES = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function TaskFilters({ taskTypes }: { taskTypes: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        defaultValue={searchParams.get("status") ?? "open"}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        defaultValue={searchParams.get("priority") ?? "all"}
        onValueChange={(v) => setParam("priority", v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        defaultValue={searchParams.get("type") ?? "all"}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {taskTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
