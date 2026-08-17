import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotificationRuleRow } from "./notification-rule-row";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  await requirePermission("notifications.manage");

  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("notification_rules")
    .select("rule_key, label, description, enabled, threshold")
    .order("label");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Enable or disable rules and set thresholds (§13). In-app only for
          MVP — email, SMS, and push are roadmap.
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">Rules</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules ?? []).map((rule) => (
              <NotificationRuleRow key={rule.rule_key} rule={rule} />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
