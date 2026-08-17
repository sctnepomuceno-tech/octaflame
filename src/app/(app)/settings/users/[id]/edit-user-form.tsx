"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateUser } from "@/app/actions/users";
import {
  ROLES,
  ROLE_LABELS,
  type PermissionKey,
  type Role,
} from "@/lib/permissions";
import { PermissionsFieldset } from "@/components/permissions-fieldset";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DspOption {
  id: string;
  name: string;
}

export function EditUserForm({
  userId,
  email,
  role: initialRole,
  dspId: initialDspId,
  permissions: initialPermissions,
  dsps,
  isSelf,
}: {
  userId: string;
  email: string;
  role: Role;
  dspId: string | null;
  permissions: string[];
  dsps: DspOption[];
  isSelf: boolean;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [dspId, setDspId] = useState<string | null>(initialDspId);
  const [permissions, setPermissions] = useState<PermissionKey[]>(initialPermissions as PermissionKey[]);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const wasManagement = initialRole === "management";
  const willBeManagement = role === "management";
  const needsConfirm = !wasManagement && willBeManagement;

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await updateUser(userId, {
        role,
        dspId: role === "dsp" ? dspId : null,
        permissions,
        confirmEmail: needsConfirm ? confirmEmail : undefined,
      });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      toast.success("User updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {isSelf ? (
        <Alert variant="warning">
          <AlertDescription>
            You can&apos;t change your own role or remove your own Management access
            — ask another Management user to do this (§5.8).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Role</Label>
          <Select
            value={role}
            onValueChange={(v) => {
              const next = v as Role;
              setRole(next);
              if (next !== "dsp") setDspId(null);
            }}
            disabled={isSelf}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {role === "dsp" ? (
          <div className="grid gap-2">
            <Label>DSP territory</Label>
            <Select value={dspId ?? undefined} onValueChange={setDspId} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue placeholder="Select a DSP" />
              </SelectTrigger>
              <SelectContent>
                {dsps.map((dsp) => (
                  <SelectItem key={dsp.id} value={dsp.id}>
                    {dsp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {needsConfirm ? (
        <div className="grid gap-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <Label>
            Type <span className="font-mono">{email}</span> to confirm granting Management access
          </Label>
          <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
        </div>
      ) : null}

      <Separator />

      <PermissionsFieldset role={role} selectedPermissions={permissions} onChange={setPermissions} />

      <div>
        <Button
          onClick={submit}
          disabled={pending || isSelf || (needsConfirm && confirmEmail.trim().toLowerCase() !== email.toLowerCase())}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
