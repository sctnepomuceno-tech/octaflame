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
 * It also seeds a small, believable batch of customers and sales for the
 * DSP test user's territory (§17's ~60/32/8 HH/RTL/WS mix, scaled down) so
 * the customers list, sales list, and DSP dashboard aren't empty on first
 * run. The full §17 volume (~250 customers, ~800 sales) plus tasks,
 * inventory, and truck reports lands once those modules exist in later
 * phases — do not scale this up until then.
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

  await seedSampleCustomersAndSales(supabase, dspIdByCode.get("WENG"));

  console.log("\nDone. These are test accounts — do not use in production.");
}

const FIRST_NAMES = ["Nena", "Rosario", "Ben", "Cora", "Danny", "Lita", "Marco", "Susan", "Toto", "Elena", "Ricky", "Fe"];
const LAST_NAMES = ["Reyes", "Santos", "Cruz", "Bautista", "Villanueva", "Gonzales", "Ramos", "Torres"];
const STORE_WORDS = ["Sari-Sari", "Mini Mart", "Store", "Trading", "Enterprises"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedSampleCustomersAndSales(
  supabase: ReturnType<typeof createAdminClient>,
  dspId: string | undefined
) {
  if (!dspId) return;

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("id")
    .eq("dsp_id", dspId)
    .limit(1);
  if (existingCustomers && existingCustomers.length > 0) {
    console.log("Sample customers already exist for this DSP — skipping sales seed.");
    return;
  }

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name")
    .eq("dsp_id", dspId);
  const { data: products } = await supabase.from("products").select("id, code");
  if (!municipalities?.length || !products?.length) return;

  const customerSpecs = [
    ...Array.from({ length: 9 }, () => "HH" as const),
    ...Array.from({ length: 5 }, () => "RTL" as const),
    ...Array.from({ length: 1 }, () => "WS" as const),
  ];

  const customerIds: { id: string; type: "HH" | "RTL" | "WS"; municipalityId: string }[] = [];

  for (const type of customerSpecs) {
    const municipality = randomFrom(municipalities);
    const ownerName = `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
    const isHousehold = type === "HH";

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        business_name: isHousehold ? null : `${ownerName.split(" ")[0]}'s ${randomFrom(STORE_WORDS)}`,
        owner_name: ownerName,
        contact_number: isHousehold ? null : `09${Math.floor(100000000 + Math.random() * 900000000)}`,
        customer_type: type,
        municipality_id: municipality.id,
        address: isHousehold ? null : `Purok ${1 + Math.floor(Math.random() * 5)}, ${municipality.name}`,
      })
      .select("id")
      .single();

    if (error || !customer) continue;
    customerIds.push({ id: customer.id, type, municipalityId: municipality.id });
  }

  const refillId = products.find((p) => p.code === "REFILL")?.id;
  const canisterId = products.find((p) => p.code === "CANISTER")?.id;
  const stove399Id = products.find((p) => p.code === "STOVE_SET_399")?.id;

  let salesCreated = 0;
  for (const customer of customerIds) {
    const purchases = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < purchases; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const saleDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const items: { product_id: string; qty_crates?: number; qty_canisters?: number; qty_sets?: number }[] = [];
      if (customer.type === "HH") {
        items.push({ product_id: refillId!, qty_canisters: 1 + Math.floor(Math.random() * 3) });
      } else {
        items.push({ product_id: refillId!, qty_crates: 1 + Math.floor(Math.random() * 3) });
        if (Math.random() < 0.15) {
          items.push({ product_id: stove399Id!, qty_sets: 1 });
        }
      }
      if (Math.random() < 0.1 && canisterId) {
        items.push({ product_id: canisterId, qty_canisters: 1 });
      }

      const paymentStatus = Math.random() < 0.85 ? "paid" : "partial";
      const { data: rpcResult, error } = await supabase.rpc("create_sale", {
        p_client_ref: crypto.randomUUID(),
        p_customer_id: customer.id,
        p_sale_date: saleDate,
        p_deployment_date: customer.type === "HH" ? null : saleDate,
        p_payment_status: paymentStatus,
        p_amount_paid: 0,
        p_empties_collected: customer.type === "HH" ? 0 : Math.floor(Math.random() * 3),
        p_crates_returned_by_customer: 0,
        p_notes: null,
        p_items: items,
      });

      if (error || !rpcResult?.[0]) continue;
      salesCreated++;

      // The RPC computes total_amount from line items after insert, so
      // amount_paid (a direct header field, not item-derived) is set here.
      const { data: createdSale } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("id", rpcResult[0].sale_id)
        .single();
      if (createdSale) {
        const amountPaid = paymentStatus === "paid" ? createdSale.total_amount : createdSale.total_amount / 2;
        await supabase.from("sales").update({ amount_paid: amountPaid }).eq("id", rpcResult[0].sale_id);
      }
    }
  }

  console.log(`Seeded ${customerIds.length} customers and ${salesCreated} sales for DSP Weng.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
