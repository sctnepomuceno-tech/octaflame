/**
 * There is no `warehouses` table (only one warehouse exists in MVP scope).
 * empties_movements rows with holder_type='warehouse' use this fixed
 * singleton id — keep in sync with the SQL functions in
 * supabase/migrations/20260104000002_empties_warehouse_tiers.sql.
 */
export const WAREHOUSE_HOLDER_ID = "00000000-0000-0000-0000-000000000000";
