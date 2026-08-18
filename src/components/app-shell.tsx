"use client";

import { useState } from "react";
import { Menu, Search } from "lucide-react";

import type { Role } from "@/lib/permissions";
import type { NavSection } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { SyncIndicator } from "@/components/sync-indicator";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { PageTransition } from "@/components/motion/page-transition";
import { RoleSwitcher } from "@/components/role-switcher";
import { PreviewBanner } from "@/components/preview-banner";

interface AppShellProps {
  sections: NavSection[];
  fullName: string;
  email: string;
  role: Role;
  isManagement: boolean;
  previewRole: Role | null;
  children: React.ReactNode;
}

export function AppShell({
  sections,
  fullName,
  email,
  role,
  isManagement,
  previewRole,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
            8
          </div>
          <span className="font-semibold tracking-tight">Octaflame OS</span>
        </div>
        <div className="p-3 pb-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-sidebar-border px-1 text-[10px]">⌘K</kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks sections={sections} />
        </div>
        {isManagement ? (
          <div className="border-t border-sidebar-border p-2">
            <RoleSwitcher previewRole={previewRole} />
          </div>
        ) : null}
        <div className="flex items-center gap-1 border-t border-sidebar-border p-2">
          <div className="min-w-0 flex-1">
            <UserMenu fullName={fullName} email={email} role={role} />
          </div>
          <NotificationBell />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden print:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle>Octaflame OS</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3">
                <NavLinks sections={sections} onNavigate={() => setMobileOpen(false)} />
              </div>
              {isManagement ? (
                <div className="border-t border-sidebar-border p-2">
                  <RoleSwitcher previewRole={previewRole} />
                </div>
              ) : null}
              <div className="border-t border-sidebar-border p-2">
                <UserMenu fullName={fullName} email={email} role={role} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="flex-1 font-semibold tracking-tight">Octaflame OS</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          >
            <Search />
          </Button>
          <NotificationBell />
        </header>

        {previewRole ? <PreviewBanner previewRole={previewRole} /> : null}
        <div className="print:hidden">
          <SyncIndicator />
        </div>
        <main className="flex-1 overflow-y-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
