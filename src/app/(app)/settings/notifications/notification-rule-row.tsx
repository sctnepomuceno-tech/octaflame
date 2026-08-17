"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateNotificationRule } from "@/app/actions/notifications";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";

export interface NotificationRuleData {
  rule_key: string;
  label: string;
  description: string;
  enabled: boolean;
  threshold: number | null;
}

export function NotificationRuleRow({ rule }: { rule: NotificationRuleData }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [threshold, setThreshold] = useState(rule.threshold ?? 0);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await updateNotificationRule(rule.rule_key, { enabled: next });
      if (result.error) {
        toast.error(result.error);
        setEnabled(!next);
        return;
      }
      router.refresh();
    });
  }

  function saveThreshold() {
    startTransition(async () => {
      const result = await updateNotificationRule(rule.rule_key, { threshold });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Threshold updated.");
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{rule.label}</div>
        <div className="text-xs text-muted-foreground">{rule.description}</div>
      </TableCell>
      <TableCell>
        {rule.threshold !== null ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-28"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              onBlur={saveThreshold}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Checkbox checked={enabled} onCheckedChange={(v) => toggle(v === true)} aria-label={`Toggle ${rule.label}`} />
      </TableCell>
    </TableRow>
  );
}
