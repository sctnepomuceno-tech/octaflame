/**
 * Seed script — Phase 1 scope (§17, §18).
 *
 * Reference data (4 DSPs, 17 municipalities, 4 products, settings, the
 * current-year KPI target) is seeded declaratively by
 * supabase/migrations/20260101000006_seed_reference_data.sql — migrations
 * are idempotent and run on every deploy, which is the right place for
 * data every environment must have.
 *
 * This script seeds the one test user per role (§17), including a viewer
 * with a partial permission set, so RBAC can be exercised locally. It is
 * NOT the bootstrap flow (§5.5) — that creates the single production
 * Management account from BOOTSTRAP_ADMIN_EMAIL/PASSWORD via
 * `npm run bootstrap:admin`. This script is for local/dev/staging only.
 *
 * Later phases extend this file with customers, sales, tasks, and
 * inventory movements (§17) once those tables exist — do not add them yet.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { createAdminClient } from "../src/lib/supabase/admin";
import { ROLE_DEFAULT_PERMISSIONS, type PermissionKey, type Role } from "../src/lib/permissions";

const TEST_PASSWORD = process.env.SEED_TEST_USER_PASSWORD ?? "Octaflame!2026";

interface SeedUser {
  email: string;
  fullName: string;
  role: Role;
  dspCode?: string;
  permissions: PermissionKey[];
}

const SEED_USERS: SeedUser[] = [
  {
    email: "management@octaflame.test",
    fullName: "Test Management",
    role: "management",
    permissions: ROLE_DEFAULT_PERMISSIONS.management,
  },
  {
    email: "dsp@octaflame.test",
    fullName: "Test DSP",
    role: "dsp",
    dspCode: "WENG",
    permissions: ROLE_DEFAULT_PERMISSIONS.dsp,
  },
  {
    email: "warehouse@octaflame.test",
    fullName: "Test Warehouse",
    role: "warehouse",
    permissions: ROLE_DEFAULT_PERMISSIONS.warehouse,
  },
  {
    email: "office@octaflame.test",
    fullName: "Test Office",
    role: "office",
    permissions: ROLE_DEFAULT_PERMISSIONS.office,
  },
  {
    email: "viewer@octaflame.test",
    fullName: "Test Viewer",
    role: "viewer",
    // Partial set, e.g. an accountant: KPI progress + reports, nothing operational (§5.3).
    permissions: ["dashboard.management", "reports.read.all"],
  },
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PRODUCTION !== "true") {
    console.error(
      "Refusing to seed test users with a known password into a production environment. " +
        "Set ALLOW_SEED_IN_PRODUCTION=true to override."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();

  const { data: dsps, error: dspError } = await supabase.from("dsps").select("id, code");
  if (dspError) {
    console.error("Failed to load DSPs — has the reference-data migration run yet?", dspError.message);
    process.exit(1);
  }
  const dspIdByCode = new Map((dsps ?? []).map((d) => [d.code, d.id]));

  for (const seedUser of SEED_USERS) {
    const dspId = seedUser.dspCode ? dspIdByCode.get(seedUser.dspCode) ?? null : null;
    if (seedUser.dspCode && !dspId) {
      console.warn(`Skipping ${seedUser.email}: DSP code ${seedUser.dspCode} not found.`);
      continue;
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", seedUser.email)
      .maybeSingle();

    let userId = existing?.id;

    if (!userId) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: seedUser.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });

      if (createError || !created?.user) {
        console.warn(`Skipping ${seedUser.email}: ${createError?.message}`);
        continue;
      }
      userId = created.user.id;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: seedUser.fullName,
        email: seedUser.email,
        role: seedUser.role,
        dsp_id: dspId,
        permissions: seedUser.permissions,
        active: true,
        must_change_password: false,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.warn(`Failed to upsert profile for ${seedUser.email}: ${profileError.message}`);
      continue;
    }

    console.log(`Seeded ${seedUser.role} test user: ${seedUser.email} / ${TEST_PASSWORD}`);
  }

  console.log("\nDone. These are test accounts — do not use in production.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
