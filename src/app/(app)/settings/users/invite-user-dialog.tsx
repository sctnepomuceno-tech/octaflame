"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteUser } from "@/app/actions/users";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validation/users";
import {
  PERMISSION_GROUPS,
  ROLES,
  ROLE_LABELS,
  defaultPermissionsForRole,
  diffFromRoleDefault,
  resolvePermissions,
  type PermissionKey,
  type Role,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

  const diff = useMemo(
    () => diffFromRoleDefault(role, selectedPermissions),
    [role, selectedPermissions]
  );

  function togglePermission(key: PermissionKey, checked: boolean) {
    const next = checked
      ? [...selectedPermissions, key]
      : selectedPermissions.filter((p) => p !== key);
    setValue("permissions", resolvePermissions(next));
  }

  function resetToRoleDefault() {
    setValue("permissions", defaultPermissionsForRole(role));
  }

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
      toast.success(`Invitation sent to ${data.email}`);
      reset(defaultValues);
      setOpen(false);
    });
  };

  return (
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
          <UserPlus /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set their own password. Permissions
            are pre-filled from the role and editable before sending (§5.6).
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

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Permissions</Label>
              <p className="text-sm text-muted-foreground">
                Pre-filled from the {ROLE_LABELS[role]} template.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetToRoleDefault}>
              Reset to role default
            </Button>
          </div>

          <div className="flex flex-col gap-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.module} className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.module}
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((perm) => {
                    const checked = selectedPermissions.includes(perm.key);
                    const isAdded = diff.added.includes(perm.key);
                    const isRemoved = diff.removed.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={cn(
                          "flex items-start gap-2 rounded-md border p-2 text-sm",
                          isAdded && "border-success/50 bg-success/5",
                          isRemoved && "border-warning/50 bg-warning/5"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => togglePermission(perm.key, v === true)}
                          className="mt-0.5"
                        />
                        <span className="flex flex-col">
                          <span className="flex items-center gap-1.5 font-medium">
                            {perm.key}
                            {isAdded ? (
                              <Badge variant="success" className="text-[10px]">added</Badge>
                            ) : null}
                            {isRemoved ? (
                              <Badge variant="warning" className="text-[10px]">removed</Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {perm.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
