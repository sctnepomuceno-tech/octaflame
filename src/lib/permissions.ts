/**
 * Single source of truth for the permission model (§5.2, §5.3, §5.10).
 * The invite flow (Phase 1) and the granular permission editor (Phase 6)
 * both import from here so role templates and dependency rules never drift
 * apart between the two screens that use them.
 */

export type Role = "management" | "dsp" | "warehouse" | "office" | "viewer";

export const ROLES: Role[] = ["management", "dsp", "warehouse", "office", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  management: "Management",
  dsp: "DSP",
  warehouse: "Warehouse",
  office: "Office",
  viewer: "Viewer",
};

export const PERMISSION_KEYS = [
  "dashboard.management",
  "dashboard.dsp.own",
  "dashboard.dsp.all",
  "dashboard.warehouse",
  "dashboard.office",
  "sales.create",
  "sales.read.own",
  "sales.read.all",
  "sales.edit.own",
  "sales.edit.all",
  "sales.delete",
  "customers.create",
  "customers.read.own",
  "customers.read.all",
  "customers.edit.own",
  "customers.edit.all",
  "tasks.create",
  "tasks.read.own",
  "tasks.read.all",
  "tasks.assign",
  "tasks.edit.own",
  "tasks.edit.all",
  "warehouse.read",
  "warehouse.create",
  "warehouse.adjust",
  "truck.read",
  "truck.create",
  "office.read",
  "office.create",
  "office.adjust",
  "reports.read.own",
  "reports.read.all",
  "export.own",
  "export.all",
  "users.manage",
  "settings.manage",
  "products.manage",
  "audit.read",
  "notifications.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

interface PermissionMeta {
  key: PermissionKey;
  description: string;
}

interface PermissionGroup {
  module: string;
  permissions: PermissionMeta[];
}

/** Grouped by module for the invite form and the Phase 6 editor (§5.10). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: "Dashboard",
    permissions: [
      { key: "dashboard.management", description: "View the Management dashboard (company-wide KPIs, leaderboard, exceptions)." },
      { key: "dashboard.dsp.own", description: "View their own DSP dashboard." },
      { key: "dashboard.dsp.all", description: "View any DSP's dashboard, not just their own." },
      { key: "dashboard.warehouse", description: "View the Warehouse dashboard." },
      { key: "dashboard.office", description: "View the Office dashboard." },
    ],
  },
  {
    module: "Sales",
    permissions: [
      { key: "sales.create", description: "Record new sales transactions." },
      { key: "sales.read.own", description: "View sales they personally recorded." },
      { key: "sales.read.all", description: "View sales from all DSPs, not just their own." },
      { key: "sales.edit.own", description: "Edit sales they personally recorded." },
      { key: "sales.edit.all", description: "Edit any sale, from any DSP." },
      { key: "sales.delete", description: "Delete a sale record." },
    ],
  },
  {
    module: "Customers",
    permissions: [
      { key: "customers.create", description: "Add new customer accounts." },
      { key: "customers.read.own", description: "View customers assigned to their own DSP." },
      { key: "customers.read.all", description: "View every customer, company-wide." },
      { key: "customers.edit.own", description: "Edit customers assigned to their own DSP." },
      { key: "customers.edit.all", description: "Edit any customer record." },
    ],
  },
  {
    module: "Tasks",
    permissions: [
      { key: "tasks.create", description: "Create follow-up tasks." },
      { key: "tasks.read.own", description: "View tasks they created or are assigned to." },
      { key: "tasks.read.all", description: "View every task, company-wide." },
      { key: "tasks.assign", description: "Assign tasks to other users." },
      { key: "tasks.edit.own", description: "Edit tasks they created or are assigned to." },
      { key: "tasks.edit.all", description: "Edit any task." },
    ],
  },
  {
    module: "Warehouse",
    permissions: [
      { key: "warehouse.read", description: "View warehouse inventory and movements." },
      { key: "warehouse.create", description: "Record warehouse stock movements." },
      { key: "warehouse.adjust", description: "Post inventory adjustments with a reason." },
      { key: "truck.read", description: "View truck reports." },
      { key: "truck.create", description: "Record truck reports." },
    ],
  },
  {
    module: "Office",
    permissions: [
      { key: "office.read", description: "View office/collateral inventory." },
      { key: "office.create", description: "Record collateral movements." },
      { key: "office.adjust", description: "Post collateral adjustments with a reason." },
    ],
  },
  {
    module: "Reports",
    permissions: [
      { key: "reports.read.own", description: "View reports scoped to their own data." },
      { key: "reports.read.all", description: "View reports across the whole company." },
      { key: "export.own", description: "Export their own data (PDF, CSV, XLS, XLSX)." },
      { key: "export.all", description: "Export company-wide data." },
    ],
  },
  {
    module: "Administration",
    permissions: [
      { key: "users.manage", description: "Invite, deactivate, and manage permissions for other users." },
      { key: "settings.manage", description: "Edit business constants, territories, and system settings." },
      { key: "products.manage", description: "Edit products and pricing." },
      { key: "audit.read", description: "View the audit log." },
      { key: "notifications.manage", description: "Configure notification rules and thresholds." },
    ],
  },
];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> =
  Object.fromEntries(
    PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((p) => [p.key, p.description])
    )
  ) as Record<PermissionKey, string>;

/** Role default templates (§5.3). Viewer starts with nothing but login. */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
  management: [...PERMISSION_KEYS],
  dsp: [
    "dashboard.dsp.own",
    "sales.create",
    "sales.read.own",
    "sales.edit.own",
    "customers.create",
    "customers.read.own",
    "customers.edit.own",
    "tasks.create",
    "tasks.read.own",
    "tasks.edit.own",
    "warehouse.read",
    "truck.read",
    "office.read",
    "reports.read.own",
    "export.own",
  ],
  warehouse: [
    "dashboard.warehouse",
    "tasks.create",
    "tasks.read.own",
    "tasks.edit.own",
    "warehouse.read",
    "warehouse.create",
    "warehouse.adjust",
    "truck.read",
    "truck.create",
    "reports.read.own",
    "export.own",
  ],
  office: [
    "dashboard.office",
    "tasks.create",
    "tasks.read.own",
    "tasks.edit.own",
    "office.read",
    "office.create",
    "office.adjust",
    "reports.read.own",
    "export.own",
  ],
  viewer: [],
};

/**
 * Dependency rules (§5.10): granting a write permission implies its
 * matching read permission. Keyed by the permission being granted; the
 * value lists prerequisites that must also be present.
 */
export const PERMISSION_PREREQUISITES: Partial<
  Record<PermissionKey, PermissionKey[]>
> = {
  "sales.edit.own": ["sales.read.own"],
  "sales.edit.all": ["sales.read.all"],
  "sales.delete": ["sales.read.all"],
  "customers.edit.own": ["customers.read.own"],
  "customers.edit.all": ["customers.read.all"],
  "tasks.edit.own": ["tasks.read.own"],
  "tasks.edit.all": ["tasks.read.all"],
  "tasks.assign": ["tasks.read.all"],
  "warehouse.create": ["warehouse.read"],
  "warehouse.adjust": ["warehouse.read"],
  "truck.create": ["truck.read"],
  "office.create": ["office.read"],
  "office.adjust": ["office.read"],
  "export.own": ["reports.read.own"],
  "export.all": ["reports.read.all"],
};

/**
 * Expands a selected permission set to include every prerequisite, then
 * drops any write permission whose prerequisite read permission is no
 * longer present (e.g. revoking sales.read.own also revokes sales.edit.own).
 * Idempotent — safe to call repeatedly.
 */
export function resolvePermissions(selected: PermissionKey[]): PermissionKey[] {
  const result = new Set(selected);

  // Add prerequisites for anything selected.
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of result) {
      for (const prereq of PERMISSION_PREREQUISITES[key] ?? []) {
        if (!result.has(prereq)) {
          result.add(prereq);
          changed = true;
        }
      }
    }
  }

  // Drop dependents whose prerequisite is missing.
  changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(result)) {
      const prereqs = PERMISSION_PREREQUISITES[key] ?? [];
      if (prereqs.some((prereq) => !result.has(prereq))) {
        result.delete(key);
        changed = true;
      }
    }
  }

  return PERMISSION_KEYS.filter((key) => result.has(key));
}

/** Management implicitly has every permission (§5.1). */
export function profileHasPermission(
  profile: { role: Role; permissions: string[] },
  permission: PermissionKey
): boolean {
  return profile.role === "management" || profile.permissions.includes(permission);
}

export function defaultPermissionsForRole(role: Role): PermissionKey[] {
  return [...ROLE_DEFAULT_PERMISSIONS[role]];
}

/** Diff against the role's default template, for the "customised" indicator (§5.10). */
export function diffFromRoleDefault(
  role: Role,
  permissions: PermissionKey[]
): { added: PermissionKey[]; removed: PermissionKey[] } {
  const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[role]);
  const current = new Set(permissions);

  return {
    added: PERMISSION_KEYS.filter((k) => current.has(k) && !defaults.has(k)),
    removed: PERMISSION_KEYS.filter((k) => !current.has(k) && defaults.has(k)),
  };
}
