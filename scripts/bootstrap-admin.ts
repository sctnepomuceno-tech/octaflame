/**
 * Bootstrap the first Management account (§5.5).
 *
 * Public signup is permanently disabled, so this script is the only path
 * into the system before any Management user exists. It is:
 *   - idempotent: safe to run more than once
 *   - self-disabling: exits without doing anything once any active
 *     Management account exists — it is not usable as a backdoor after go-live
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:admin
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the
 * environment (via .env.local if present). Never commit real values for any
 * of these.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv(); // fall back to .env if present

import { createAdminClient } from "../src/lib/supabase/admin";
import { ROLE_DEFAULT_PERMISSIONS } from "../src/lib/permissions";

async function findExistingAuthUserByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`Failed to list existing auth users: ${error.message}`);
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );
}

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set. Aborting."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();

  // Self-disabling: if any active Management account already exists, do nothing.
  const { data: existingManagement, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "management")
    .eq("active", true)
    .limit(1);

  if (checkError) {
    console.error(
      "Failed to check for an existing Management account:",
      checkError.message
    );
    process.exit(1);
  }

  if (existingManagement && existingManagement.length > 0) {
    console.log(
      "An active Management account already exists. Bootstrap is self-disabled — exiting without changes."
    );
    return;
  }

  // Create (or recover) the auth user.
  let userId: string;
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created?.user) {
    const alreadyExists =
      createError?.message?.toLowerCase().includes("already") ?? false;

    if (!alreadyExists) {
      console.error(
        "Failed to create bootstrap admin auth user:",
        createError?.message
      );
      process.exit(1);
    }

    const existingUser = await findExistingAuthUserByEmail(supabase, email);
    if (!existingUser) {
      console.error(
        "Auth reported the email already exists, but it could not be located. Aborting."
      );
      process.exit(1);
    }
    userId = existingUser.id;
  } else {
    userId = created.user.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: "Management",
      email,
      role: "management",
      permissions: ROLE_DEFAULT_PERMISSIONS.management,
      active: true,
      must_change_password: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error(
      "Failed to create the profile row for the bootstrap admin:",
      profileError.message
    );
    process.exit(1);
  }

  console.log(`Bootstrap Management account ready: ${email}`);
  console.log(
    "must_change_password = true — the user will be forced to set a new password on first login."
  );
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
