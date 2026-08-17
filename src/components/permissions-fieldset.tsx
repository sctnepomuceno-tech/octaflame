"use client";

import {
  PERMISSION_GROUPS,
  ROLE_LABELS,
  defaultPermissionsForRole,
  diffFromRoleDefault,
  resolvePermissions,
  type PermissionKey,
  type Role,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

/**
 * Module-grouped permission checkboxes with plain-language descriptions and
 * a visual diff against the role's default template (§5.10). Shared by the
 * invite dialog (Phase 1) and the user edit screen (Phase 6) so the two
 * places that edit a permission array never drift apart.
 */
export function PermissionsFieldset({
  role,
  selectedPermissions,
  onChange,
}: {
  role: Role;
  selectedPermissions: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
}) {
  const diff = diffFromRoleDefault(role, selectedPermissions);

  function togglePermission(key: PermissionKey, checked: boolean) {
    const next = checked
      ? [...selectedPermissions, key]
      : selectedPermissions.filter((p) => p !== key);
    onChange(resolvePermissions(next));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Permissions</Label>
          <p className="text-sm text-muted-foreground">
            Pre-filled from the {ROLE_LABELS[role]} template.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(defaultPermissionsForRole(role))}
        >
          Reset to role default
        </Button>
      </div>

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
                      {isAdded ? <Badge variant="success" className="text-[10px]">added</Badge> : null}
                      {isRemoved ? <Badge variant="warning" className="text-[10px]">removed</Badge> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{perm.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
