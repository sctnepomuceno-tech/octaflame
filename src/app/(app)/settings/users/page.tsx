import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteUserDialog } from "./invite-user-dialog";
import { ReactivateButton } from "./[id]/reactivate-button";
import { DeleteUserDialog } from "./delete-user-dialog";
import { CancelInviteButton } from "./cancel-invite-button";
import { SetPasswordButton } from "./set-password-button";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requirePermission("users.manage");

  const supabase = await createClient();

  const [{ data: profilesRaw }, { data: dsps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, dsp_id, active, must_change_password, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
  ]);

  const dspNameById = new Map((dsps ?? []).map((dsp) => [dsp.id, dsp.name]));
  const profiles = profilesRaw ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Invite teammates and manage who has access.
          </p>
        </div>
        <InviteUserDialog dsps={dsps ?? []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>DSP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Link href={`/settings/users/${profile.id}`} className="font-medium hover:underline">
                      {profile.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.dsp_id ? dspNameById.get(profile.dsp_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell>
                    {!profile.active ? (
                      <Badge variant="destructive">Deactivated</Badge>
                    ) : profile.must_change_password ? (
                      <Badge variant="warning">Invited</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!profile.active ? (
                        <>
                          <ReactivateButton userId={profile.id} variant="ghost" />
                          <DeleteUserDialog userId={profile.id} userName={profile.full_name} />
                        </>
                      ) : profile.must_change_password ? (
                        <>
                          <SetPasswordButton userId={profile.id} email={profile.email} variant="ghost" />
                          <CancelInviteButton userId={profile.id} variant="ghost" />
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
