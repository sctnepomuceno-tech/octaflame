/**
 * The single source of truth for canister → kg → MT math (§7.1).
 * Every screen that computes volume imports from this module — never
 * duplicate this arithmetic at a call site.
 *
 * Pure and framework-free by design: constants are passed in explicitly
 * (see ./constants.ts for the settings-backed loader) so this file can be
 * unit-tested without a database.
 */

export interface VolumeConstants {
  /** CANISTERS_PER_CRATE — settings key `canisters_per_crate`. */
  canistersPerCrate: number;
  /** KG_PER_CANISTER — settings key `kg_per_canister`. */
  kgPerCanister: number;
}

export interface LineQuantities {
  qtyCrates: number;
  qtyCanisters: number;
  qtySets: number;
  /** product.canisters_included — 1 for REFILL/CANISTER/STOVE_SET_399, 3 for STOVE_SET_599. */
  canistersIncludedPerSet: number;
}

/**
 * lineCanisters = (qtyCrates × CANISTERS_PER_CRATE) + qtyCanisters + (qtySets × product.canistersIncluded)
 */
export function lineCanisters(
  qty: LineQuantities,
  constants: VolumeConstants
): number {
  return (
    qty.qtyCrates * constants.canistersPerCrate +
    qty.qtyCanisters +
    qty.qtySets * qty.canistersIncludedPerSet
  );
}

/**
 * lineVolumeKg = lineCanisters × KG_PER_CANISTER
 */
export function lineVolumeKg(
  qty: LineQuantities,
  constants: VolumeConstants
): number {
  return lineCanisters(qty, constants) * constants.kgPerCanister;
}

/** saleVolumeKg = Σ lineVolumeKg */
export function sumVolumeKg(lineVolumesKg: number[]): number {
  return lineVolumesKg.reduce((total, kg) => total + kg, 0);
}

/** saleVolumeMt = saleVolumeKg / 1000 */
export function kgToMt(kg: number): number {
  return kg / 1000;
}

export function mtToKg(mt: number): number {
  return mt * 1000;
}

/** Canisters equivalent to a given number of crates, for live "× 24" helper text. */
export function crateCanisterEquivalent(
  crates: number,
  constants: VolumeConstants
): number {
  return crates * constants.canistersPerCrate;
}
