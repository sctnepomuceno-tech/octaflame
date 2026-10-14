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
  hrefFor,
}: {
  value: string;
  options: { value: string; label: string }[];
  /** Builds the URL to navigate to for a chosen month key. Defaults to the Management dashboard's MTD view. */
  hrefFor?: (month: string) => string;
}) {
  const router = useRouter();
  const buildHref = hrefFor ?? ((v: string) => `/?period=mtd&month=${v}`);

  return (
    <Select value={value} onValueChange={(v) => router.push(buildHref(v))}>
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
