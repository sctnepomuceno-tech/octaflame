"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";

import { inviteUser } from "@/app/actions/users";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validation/users";
import {
  ROLES,
  ROLE_LABELS,
  defaultPermissionsForRole,
  resolvePermissions,
  type PermissionKey,
  type Role,
} from "@/lib/permissions";
import { PermissionsFieldset } from "@/components/permissions-fieldset";
import { CredentialsDialog } from "./credentials-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const EMPTY_PERMISSIONS: PermissionKey[] = [];

const defaultValues: InviteUserInput = {
  fullName: "",
  email: "",
  phone: "",
  role: "viewer",
  dspId: null,
  permissions: [],
};

export function InviteUserDialog({ dsps }: { dsps: DspOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues,
  });

  const role = watch("role") as Role;
  const selectedPermissions = (watch("permissions") ?? EMPTY_PERMISSIONS) as PermissionKey[];

  useEffect(() => {
    // Re-seed permissions from the role's default template whenever role changes.
    setValue("permissions", defaultPermissionsForRole(role));
    if (role !== "dsp") {
      setValue("dspId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const onSubmit = (data: InviteUserInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await inviteUser({
        ...data,
        permissions: resolvePermissions(data.permissions as PermissionKey[]),
      });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      reset(defaultValues);
      setOpen(false);
      if (result.tempPassword) {
        setCredentials({ email: data.email, password: result.tempPassword });
      }
    });
  };

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset(defaultValues);
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            No email is sent — you&apos;ll get a temporary password to share
            with them directly, and they&apos;ll set their own on first
            sign-in. Permissions are pre-filled from the role and editable
            before creating the account (§5.6).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...register("fullName")} />
              {errors.fullName ? (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>
            {role === "dsp" ? (
              <div className="grid gap-2 sm:col-span-2">
                <Label>DSP territory</Label>
                <Controller
                  control={control}
                  name="dspId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
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
                  )}
                />
                {errors.dspId ? (
                  <p className="text-sm text-destructive">{errors.dspId.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <Separator />

          <PermissionsFieldset
            role={role}
            selectedPermissions={selectedPermissions}
            onChange={(next) => setValue("permissions", next)}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {credentials ? (
      <CredentialsDialog
        email={credentials.email}
        password={credentials.password}
        onOpenChange={(next) => {
          if (!next) setCredentials(null);
        }}
      />
    ) : null}
    </>
  );
}
