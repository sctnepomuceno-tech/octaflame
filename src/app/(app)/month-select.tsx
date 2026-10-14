"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MonthSelect({
  value,
  options,
  basePath = "/",
  params = {},
}: {
  value: string;
  options: { value: string; label: string }[];
  /** Page to navigate to. Defaults to the Management dashboard's MTD view. */
  basePath?: string;
  /** Other query params to carry over alongside "month" — plain strings only, since this is a Client Component. */
  params?: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const sp = new URLSearchParams(params);
        sp.set("month", v);
        router.push(`${basePath}?${sp.toString()}`);
      }}
    >
      <SelectTrigger className="w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
