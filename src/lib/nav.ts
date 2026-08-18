import { profileHasPermission, type PermissionKey, type Role } from "@/lib/permissions";

export const NAV_ICON_KEYS = [
  "home",
  "plus",
  "route",
  "usersRound",
  "receipt",
  "listChecks",
  "listTodo",
  "package",
  "truck",
  "megaphone",
  "fileDown",
  "barChart3",
  "users",
  "mapPin",
  "packageSearch",
  "calendarCheck",
  "history",
  "bell",
] as const;

export type NavIconKey = (typeof NAV_ICON_KEYS)[number];

export interface NavItem {
  label: string;
  href: string;
  // A component reference (e.g. a Lucide icon function) isn't serializable
  // across the server/client boundary, so nav sections carry a key instead —
  // nav-links.tsx (a Client Component) owns the key -> icon component map.
  icon: NavIconKey;
  /** Visible to any active user when omitted. An array means "any of these". */
  permission?: PermissionKey | PermissionKey[];
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

function itemVisible(
  profile: { role: Role; permissions: string[] },
  item: NavItem
): boolean {
  if (!item.permission) return true;
  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
  return perms.some((p) => profileHasPermission(profile, p));
}

/**
 * Declarative nav, filtered per-user by permission (§5, §16). Only entries
 * for modules that exist so far are listed — later phases append their own
 * section here as each module ships, in build-phase order (§18).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ label: "Home", href: "/", icon: "home" }],
  },
  {
    label: "Sales",
    items: [
      { label: "New sale", href: "/sales/new", icon: "plus", permission: "sales.create" },
      { label: "Route mode", href: "/sales/route-mode", icon: "route", permission: "sales.create" },
      {
        label: "Customers",
        href: "/customers",
        icon: "usersRound",
        permission: ["customers.read.own", "customers.read.all"],
      },
      {
        label: "Sales",
        href: "/sales",
        icon: "receipt",
        permission: ["sales.read.own", "sales.read.all"],
      },
      {
        label: "Sync issues",
        href: "/sync-issues",
        icon: "listChecks",
        permission: "sales.create",
      },
    ],
  },
  {
    label: "Follow-ups",
    items: [
      {
        label: "Tasks",
        href: "/tasks",
        icon: "listTodo",
        permission: ["tasks.read.own", "tasks.read.all"],
      },
    ],
  },
  {
    label: "Warehouse",
    items: [
      {
        label: "Stock issuances",
        href: "/stock/issuances",
        icon: "package",
        permission: ["warehouse.read", "warehouse.create"],
      },
      {
        label: "Truck reports",
        href: "/warehouse/truck-reports",
        icon: "truck",
        permission: ["truck.read", "truck.create"],
      },
    ],
  },
  {
    label: "Office",
    items: [
      {
        label: "Collateral",
        href: "/office/collateral",
        icon: "megaphone",
        permission: ["office.read", "office.create"],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: "fileDown",
        permission: ["reports.read.own", "reports.read.all"],
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: "barChart3",
        permission: "dashboard.management",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/settings/users", icon: "users", permission: "users.manage" },
      { label: "Territories", href: "/settings/territories", icon: "mapPin", permission: "settings.manage" },
      { label: "Products", href: "/settings/products", icon: "packageSearch", permission: "products.manage" },
      { label: "Periods", href: "/settings/periods", icon: "calendarCheck", permission: "settings.manage" },
      { label: "Audit log", href: "/settings/audit-log", icon: "history", permission: "audit.read" },
      { label: "Notifications", href: "/settings/notifications", icon: "bell", permission: "notifications.manage" },
    ],
  },
];

export function visibleNavSections(
  profile: { role: Role; permissions: string[] }
): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemVisible(profile, item)),
  })).filter((section) => section.items.length > 0);
}
