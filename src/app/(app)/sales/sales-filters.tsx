"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

export function SalesFilters({ dsps, municipalities }: { dsps: Option[]; municipalities: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        type="date"
        className="w-40"
        defaultValue={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
      />
      <Input
        type="date"
        className="w-40"
        defaultValue={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
      />
      {dsps.length > 0 ? (
        <Select defaultValue={searchParams.get("dsp") ?? "all"} onValueChange={(v) => setParam("dsp", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All DSPs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All DSPs</SelectItem>
            {dsps.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        defaultValue={searchParams.get("municipality") ?? "all"}
        onValueChange={(v) => setParam("municipality", v)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="All municipalities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All municipalities</SelectItem>
          {municipalities.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("type") ?? "all"} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="HH">Household</SelectItem>
          <SelectItem value="RTL">Retail</SelectItem>
          <SelectItem value="WS">Wholesale</SelectItem>
        </SelectContent>
      </Select>
      <Select value={searchParams.get("payment") ?? "all"} onValueChange={(v) => setParam("payment", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All payments</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
