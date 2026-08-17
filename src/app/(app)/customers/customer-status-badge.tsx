import { Badge } from "@/components/ui/badge";
import type { CustomerStatus } from "@/lib/supabase/database.types";

const STATUS_META: Record<CustomerStatus, { label: string; variant: "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  prospect: { label: "Prospect", variant: "outline" },
  newly_acquired: { label: "New", variant: "secondary" },
  active: { label: "Active", variant: "success" },
  dormant: { label: "Dormant", variant: "warning" },
  inactive: { label: "Inactive", variant: "destructive" },
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
