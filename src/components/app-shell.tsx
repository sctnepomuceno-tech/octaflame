"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

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

interface AppShellProps {
  sections: NavSection[];
  fullName: string;
  email: string;
  role: Role;
  children: React.ReactNode;
}

export function AppShell({
  sections,
  fullName,
  email,
  role,
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
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks sections={sections} />
        </div>
        <div className="border-t border-sidebar-border p-2">
          <UserMenu fullName={fullName} email={email} role={role} />
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
              <div className="border-t border-sidebar-border p-2">
                <UserMenu fullName={fullName} email={email} role={role} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold tracking-tight">Octaflame OS</span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
