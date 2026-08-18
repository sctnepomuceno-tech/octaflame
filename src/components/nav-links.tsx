"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  FileDown,
  History,
  Home,
  ListChecks,
  ListTodo,
  MapPin,
  Package,
  PackageSearch,
  Plus,
  Receipt,
  Route,
  Truck,
  Users,
  UsersRound,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavIconKey, NavSection } from "@/lib/nav";

const ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  plus: Plus,
  route: Route,
  usersRound: UsersRound,
  receipt: Receipt,
  listChecks: ListChecks,
  listTodo: ListTodo,
  package: Package,
  truck: Truck,
  megaphone: Megaphone,
  fileDown: FileDown,
  barChart3: BarChart3,
  users: Users,
  mapPin: MapPin,
  packageSearch: PackageSearch,
  calendarCheck: CalendarCheck,
  history: History,
  bell: Bell,
};

export function NavLinks({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.label ?? "root"} className="flex flex-col gap-1">
          {section.label ? (
            <span className="px-2 text-xs font-medium text-muted-foreground">
              {section.label}
            </span>
          ) : null}
          {section.items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
