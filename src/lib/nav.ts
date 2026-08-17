import type { LucideIcon } from "lucide-react";
import { Home, Package, Plus, Receipt, Truck, Users, UsersRound, Megaphone } from "lucide-react";

import { profileHasPermission, type PermissionKey, type Role } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
    items: [{ label: "Home", href: "/", icon: Home }],
  },
  {
    label: "Sales",
    items: [
      { label: "New sale", href: "/sales/new", icon: Plus, permission: "sales.create" },
      {
        label: "Customers",
        href: "/customers",
        icon: UsersRound,
        permission: ["customers.read.own", "customers.read.all"],
      },
      {
        label: "Sales",
        href: "/sales",
        icon: Receipt,
        permission: ["sales.read.own", "sales.read.all"],
      },
    ],
  },
  {
    label: "Warehouse",
    items: [
      {
        label: "Stock issuances",
        href: "/stock/issuances",
        icon: Package,
        permission: ["warehouse.read", "warehouse.create"],
      },
      {
        label: "Truck reports",
        href: "/warehouse/truck-reports",
        icon: Truck,
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
        icon: Megaphone,
        permission: ["office.read", "office.create"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/settings/users", icon: Users, permission: "users.manage" },
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
