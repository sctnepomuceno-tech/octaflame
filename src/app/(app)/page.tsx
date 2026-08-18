import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { requireProfile, profileHasPermission } from "@/lib/auth/current-user";
import { getViewAsRole } from "@/lib/auth/view-as";
import { ROLE_LABELS, defaultPermissionsForRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Period } from "@/lib/dates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DspDashboard } from "./dsp-dashboard";
import { ManagementDashboard } from "./management-dashboard";
import { WarehouseDashboard } from "./warehouse-dashboard";
import { OfficeDashboard } from "./office-dashboard";

const VALID_PERIODS: Period[] = ["today", "wtd", "mtd", "ytd"];

export default async function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const params = await props.searchParams;
  const periodParam = typeof params.period === "string" ? params.period : "mtd";
  const period = VALID_PERIODS.find((p) => p === periodParam) ?? "mtd";

  const supabase = await createClient();

  const previewRole = profile.role === "management" ? await getViewAsRole() : null;
  const displayProfile = previewRole
    ? { role: previewRole, permissions: defaultPermissionsForRole(previewRole) }
    : profile;

  let singleManagementAccount = false;
  if (!previewRole && profileHasPermission(profile, "users.manage")) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "management")
      .eq("active", true);
    singleManagementAccount = (count ?? 0) <= 1;
  }

  if (displayProfile.role === "dsp") {
    // Previewing as DSP: Management has no dsp_id of their own, so preview
    // against the first active territory instead of showing nothing.
    const dspId = previewRole ? null : profile.dsp_id;
    const { data: previewDsp } = previewRole
      ? await supabase.from("dsps").select("id, name").eq("active", true).order("name").limit(1).maybeSingle()
      : { data: null };
    const resolvedDspId = dspId ?? previewDsp?.id ?? null;

    if (resolvedDspId) {
      const { data: dsp } = await supabase.from("dsps").select("name").eq("id", resolvedDspId).single();
      return (
        <>
          {singleManagementAccount ? (
            <div className="mx-auto max-w-5xl p-6 pb-0">
              <SingleManagementBanner />
            </div>
          ) : null}
          <DspDashboard
            dspId={resolvedDspId}
            dspName={dsp?.name ?? "Your territory"}
            userId={profile.id}
            period={period}
          />
        </>
      );
    }
  }

  if (profileHasPermission(displayProfile, "dashboard.management")) {
    return (
      <>
        {singleManagementAccount ? (
          <div className="mx-auto max-w-6xl p-6 pb-0">
            <SingleManagementBanner />
          </div>
        ) : null}
        <ManagementDashboard period={period} />
      </>
    );
  }

  if (profileHasPermission(displayProfile, "dashboard.warehouse")) {
    return <WarehouseDashboard />;
  }

  if (profileHasPermission(displayProfile, "dashboard.office")) {
    return <OfficeDashboard />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {singleManagementAccount ? <SingleManagementBanner /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Welcome, {profile.full_name.split(" ")[0]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Signed in as <span className="text-foreground">{profile.email}</span>{" "}
            with the <span className="text-foreground">{ROLE_LABELS[displayProfile.role]}</span> role.
          </p>
          <p>
            The Management, Warehouse, and Office dashboards arrive in later
            build phases. Customers and Sales are live if your permissions
            include them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SingleManagementBanner() {
  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>Only one Management account exists</AlertTitle>
      <AlertDescription>
        A forgotten password would lock the business out of its own system.
        Invite a second Management account from{" "}
        <Link href="/settings/users" className="underline underline-offset-2">
          Users
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
