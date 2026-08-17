"use server";

import { revalidatePath } from "next/cache";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function createTruckReport(input: {
  reportDate: string;
  truckPlate?: string;
  driverName?: string;
  helperName?: string;
  dspId?: string;
  destinationMunicipalityIds: string[];
  cratesOut: number;
  cratesReturned: number;
  emptyCratesCollected: number;
  stovesOut: number;
  stovesReturned: number;
  fuelCost: number;
  odometerStart?: number;
  odometerEnd?: number;
  remarks?: string;
}): Promise<ActionResult> {
  const profile = await requireAnyPermission(["truck.create"]);
  const supabase = await createClient();

  const { error } = await supabase.from("truck_reports").insert({
    report_date: input.reportDate,
    truck_plate: input.truckPlate || null,
    driver_name: input.driverName || null,
    helper_name: input.helperName || null,
    dsp_id: input.dspId || null,
    destination_municipality_ids: input.destinationMunicipalityIds,
    crates_out: input.cratesOut,
    crates_returned: input.cratesReturned,
    empty_crates_collected: input.emptyCratesCollected,
    stoves_out: input.stovesOut,
    stoves_returned: input.stovesReturned,
    fuel_cost: input.fuelCost,
    odometer_start: input.odometerStart ?? null,
    odometer_end: input.odometerEnd ?? null,
    remarks: input.remarks || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/warehouse/truck-reports");
  return { success: true };
}
