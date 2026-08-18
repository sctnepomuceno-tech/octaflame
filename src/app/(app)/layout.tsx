import { requireProfile } from "@/lib/auth/current-user";
import { getViewAsRole } from "@/lib/auth/view-as";
import { visibleNavSections } from "@/lib/nav";
import { defaultPermissionsForRole } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const previewRole = profile.role === "management" ? await getViewAsRole() : null;

  const displayProfile = previewRole
    ? { role: previewRole, permissions: defaultPermissionsForRole(previewRole) }
    : profile;
  const sections = visibleNavSections(displayProfile);

  return (
    <AppShell
      sections={sections}
      fullName={profile.full_name}
      email={profile.email}
      role={profile.role}
      isManagement={profile.role === "management"}
      previewRole={previewRole}
    >
      {children}
    </AppShell>
  );
}
