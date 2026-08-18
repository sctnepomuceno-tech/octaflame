import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditUserForm } from "./edit-user-form";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { ReactivateButton } from "./reactivate-button";
import { DeleteUserDialog } from "../delete-user-dialog";
import { CancelInviteButton } from "../cancel-invite-button";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  const actingProfile = await requirePermission("users.manage");
  const { id } = await props.params;

  const supabase = await createClient();
  const [{ data: target }, { data: dsps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, dsp_id, permissions, active, must_change_password, deactivated_at, created_at")
      .eq("id", id)
      .single(),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
  ]);

  if (!target) {
    notFound();
  }

  const isSelf = target.id === actingProfile.id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/settings/users">
            <ArrowLeft /> Users
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{target.full_name}</h1>
              <Badge variant="secondary">{ROLE_LABELS[target.role]}</Badge>
              {!target.active ? <Badge variant="destructive">Deactivated</Badge> : null}
              {isSelf ? <Badge variant="outline">You</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{target.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {target.active ? (
              target.must_change_password ? (
                <CancelInviteButton userId={target.id} />
              ) : (
                <DeactivateUserDialog userId={target.id} userName={target.full_name} isDsp={target.role === "dsp"} />
              )
            ) : (
              <>
                <ReactivateButton userId={target.id} />
                <DeleteUserDialog userId={target.id} userName={target.full_name} />
              </>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role, territory & permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <EditUserForm
            userId={target.id}
            email={target.email}
            role={target.role}
            dspId={target.dsp_id}
            permissions={target.permissions}
            dsps={dsps ?? []}
            isSelf={isSelf}
          />
        </CardContent>
      </Card>
    </div>
  );
}
