"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { toast } from "sonner";

import { setViewAsRole } from "@/app/actions/view-as";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREVIEWABLE_ROLES = ROLES.filter((role) => role !== "management");

export function RoleSwitcher({ previewRole }: { previewRole: Role | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(value: string) {
    const role = value === "management" ? null : (value as Role);
    startTransition(async () => {
      const result = await setViewAsRole(role);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Select value={previewRole ?? "management"} onValueChange={submit} disabled={pending}>
      <SelectTrigger size="sm" className="w-full gap-1.5 border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/80">
        <Eye className="size-3.5 shrink-0" />
        <SelectValue placeholder="Your view" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="management">Your view (Management)</SelectItem>
        {PREVIEWABLE_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            Preview: {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
