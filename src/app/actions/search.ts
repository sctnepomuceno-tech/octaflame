"use server";

import { requireProfile, profileHasPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  category: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const RESULT_LIMIT = 5;

/**
 * Global search across the modules named in §14, each gated by the same
 * permission that gates the module's own page — RLS still scopes the rows
 * within each query, this just decides whether to search a table at all.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const profile = await requireProfile();
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const tasks: PromiseLike<void>[] = [];

  if (profileHasPermission(profile, "customers.read.own") || profileHasPermission(profile, "customers.read.all")) {
    tasks.push(
      supabase
        .from("customers")
        .select("id, business_name, owner_name")
        .is("deleted_at", null)
        .or(`business_name.ilike.${like},owner_name.ilike.${like}`)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const c of data ?? []) {
            results.push({
              category: "Customers",
              id: c.id,
              title: c.business_name || c.owner_name || "Customer",
              subtitle: c.business_name ? c.owner_name ?? undefined : undefined,
              href: `/customers/${c.id}`,
            });
          }
        })
    );
  }

  if (profileHasPermission(profile, "sales.read.own") || profileHasPermission(profile, "sales.read.all")) {
    tasks.push(
      supabase
        .from("sales")
        .select("id, receipt_no, sale_date")
        .is("deleted_at", null)
        .ilike("receipt_no", like)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const s of data ?? []) {
            results.push({
              category: "Sales",
              id: s.id,
              title: s.receipt_no,
              subtitle: s.sale_date,
              href: `/sales/${s.id}`,
            });
          }
        })
    );
  }

  tasks.push(
    supabase
      .from("municipalities")
      .select("id, name")
      .eq("active", true)
      .ilike("name", like)
      .limit(RESULT_LIMIT)
      .then(({ data }) => {
        for (const m of data ?? []) {
          results.push({
            category: "Municipalities",
            id: m.id,
            title: m.name,
            href: `/customers?municipality=${m.id}`,
          });
        }
      })
  );

  if (profileHasPermission(profile, "sales.read.all")) {
    tasks.push(
      supabase
        .from("dsps")
        .select("id, name")
        .eq("active", true)
        .ilike("name", like)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const d of data ?? []) {
            results.push({ category: "DSPs", id: d.id, title: d.name, href: `/sales?dsp=${d.id}` });
          }
        })
    );
  }

  if (profileHasPermission(profile, "warehouse.read")) {
    tasks.push(
      supabase
        .from("inventory_items")
        .select("id, name")
        .eq("active", true)
        .ilike("name", like)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const i of data ?? []) {
            results.push({ category: "Inventory items", id: i.id, title: i.name, href: `/stock/issuances` });
          }
        })
    );
  }

  if (profileHasPermission(profile, "truck.read")) {
    tasks.push(
      supabase
        .from("truck_reports")
        .select("id, truck_plate, driver_name, report_date")
        .or(`truck_plate.ilike.${like},driver_name.ilike.${like}`)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const t of data ?? []) {
            results.push({
              category: "Truck reports",
              id: t.id,
              title: t.truck_plate || t.driver_name || t.report_date,
              subtitle: t.report_date,
              href: `/warehouse/truck-reports`,
            });
          }
        })
    );
  }

  if (profileHasPermission(profile, "tasks.read.own") || profileHasPermission(profile, "tasks.read.all")) {
    tasks.push(
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .ilike("title", like)
        .limit(RESULT_LIMIT)
        .then(({ data }) => {
          for (const t of data ?? []) {
            results.push({
              category: "Tasks",
              id: t.id,
              title: t.title,
              subtitle: t.due_date ?? undefined,
              href: `/tasks`,
            });
          }
        })
    );
  }

  await Promise.all(tasks);
  return results;
}
