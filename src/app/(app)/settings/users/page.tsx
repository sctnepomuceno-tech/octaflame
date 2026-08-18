import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDistanceToNow } from "date-fns";
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
import { InvitationActions } from "./invitation-actions";
import { ReinviteButton } from "./reinvite-button";
import { ReactivateButton } from "./[id]/reactivate-button";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requirePermission("users.manage");

  const supabase = await createClient();

  const [{ data: profilesRaw }, { data: invitations }, { data: dsps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, dsp_id, active, must_change_password, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, created_at")
      .eq("status", "pending")
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

      {invitations && invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABELS[invite.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <InvitationActions invitationId={invite.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

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
                      {profile.must_change_password ? (
                        <ReinviteButton userId={profile.id} variant="ghost" />
                      ) : !profile.active ? (
                        <ReactivateButton userId={profile.id} variant="ghost" />
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
