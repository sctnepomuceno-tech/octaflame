import type { LucideIcon } from "lucide-react";
import { Home, Users } from "lucide-react";

import { profileHasPermission, type PermissionKey, type Role } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visible to any active user when omitted. */
  permission?: PermissionKey;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
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
    items: section.items.filter(
      (item) => !item.permission || profileHasPermission(profile, item.permission)
    ),
  })).filter((section) => section.items.length > 0);
}
