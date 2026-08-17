import { requireProfile } from "@/lib/auth/current-user";
import { visibleNavSections } from "@/lib/nav";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const sections = visibleNavSections(profile);

  return (
    <AppShell
      sections={sections}
      fullName={profile.full_name}
      email={profile.email}
      role={profile.role}
    >
      {children}
    </AppShell>
  );
}
