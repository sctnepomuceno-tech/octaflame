import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { requireProfile, profileHasPermission } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Period } from "@/lib/dates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DspDashboard } from "./dsp-dashboard";
import { ManagementDashboard } from "./management-dashboard";

const VALID_PERIODS: Period[] = ["today", "wtd", "mtd", "ytd"];

export default async function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const params = await props.searchParams;
  const periodParam = typeof params.period === "string" ? params.period : "mtd";
  const period = VALID_PERIODS.find((p) => p === periodParam) ?? "mtd";

  const supabase = await createClient();

  let singleManagementAccount = false;
  if (profileHasPermission(profile, "users.manage")) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "management")
      .eq("active", true);
    singleManagementAccount = (count ?? 0) <= 1;
  }

  if (profile.role === "dsp" && profile.dsp_id) {
    const { data: dsp } = await supabase.from("dsps").select("name").eq("id", profile.dsp_id).single();
    return (
      <>
        {singleManagementAccount ? (
          <div className="mx-auto max-w-5xl p-6 pb-0">
            <SingleManagementBanner />
          </div>
        ) : null}
        <DspDashboard dspId={profile.dsp_id} dspName={dsp?.name ?? "Your territory"} period={period} />
      </>
    );
  }

  if (profileHasPermission(profile, "dashboard.management")) {
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
            with the <span className="text-foreground">{ROLE_LABELS[profile.role]}</span> role.
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
