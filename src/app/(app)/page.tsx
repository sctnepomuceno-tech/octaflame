import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { requireProfile, profileHasPermission } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomePage() {
  const profile = await requireProfile();

  let singleManagementAccount = false;
  if (profileHasPermission(profile, "users.manage")) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "management")
      .eq("active", true);
    singleManagementAccount = (count ?? 0) <= 1;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {singleManagementAccount ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Only one Management account exists</AlertTitle>
          <AlertDescription>
            A forgotten password would lock the business out of its own
            system. Invite a second Management account from{" "}
            <Link href="/settings/users" className="underline underline-offset-2">
              Users
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

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
            Dashboards, sales entry, and the rest of the operational modules
            arrive in later build phases. Foundation — auth, permissions, and
            user management — is live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
