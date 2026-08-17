-- Seed reference data: settings (§3), DSPs, municipalities (§2), products (§6.1),
-- current-year KPI target. Idempotent — safe to re-run.

-- Settings ----------------------------------------------------------------
insert into public.settings (key, value, data_type, label, description)
values
  ('canisters_per_crate', '24', 'number', 'Canisters per crate', 'Physical count of canisters in one crate.'),
  ('kg_per_canister', '0.17', 'number', 'Net LPG per canister (kg)', 'Net LPG weight per canister, in kilograms.'),
  ('kpi_accounts_target', '300', 'number', 'Annual KPI — accounts', 'Unique RTL + WS accounts target for the fiscal year.'),
  ('kpi_volume_target_mt', '14.45', 'number', 'Annual KPI — volume (MT)', 'Metric tonnes of LPG volume target for the fiscal year.'),
  ('fiscal_year_start_month', '1', 'number', 'Fiscal year start month', 'Calendar year, Jan 1 - Dec 31.'),
  ('currency', 'PHP', 'string', 'Currency', 'Currency code used across the app.'),
  ('timezone', 'Asia/Manila', 'string', 'Timezone', 'Timezone used for all date/time displays and computations.'),
  ('customer_status_newly_acquired_days', '30', 'number', 'Newly acquired threshold (days)', 'First purchase within this many days = newly_acquired.'),
  ('customer_status_active_days', '60', 'number', 'Active threshold (days)', 'Purchased within this many days = active.'),
  ('customer_status_dormant_days', '120', 'number', 'Dormant threshold (days)', 'Last purchase between active and this many days ago = dormant; beyond = inactive.'),
  ('stock_variance_notification_threshold', '10', 'number', 'Stock variance alert threshold', 'Absolute unit variance that raises a notification to Management.'),
  ('empties_balance_notification_threshold', '20', 'number', 'Customer empties balance alert threshold', 'Shells/crates owed by a customer that raises a notification.')
on conflict (key) do nothing;

-- DSPs ----------------------------------------------------------------------
insert into public.dsps (name, code)
values
  ('DSP Weng', 'WENG'),
  ('DSP Genie', 'GENIE'),
  ('DSP Grace', 'GRACE'),
  ('DSP Mark', 'MARK')
on conflict (code) do nothing;

-- Municipalities (§2) --------------------------------------------------------
insert into public.municipalities (name, dsp_id)
select m.name, d.id
from (
  values
    ('Castilla', 'WENG'), ('Donsol', 'WENG'), ('Pilar', 'WENG'), ('Sorsogon', 'WENG'), ('Bacon', 'WENG'),
    ('Gubat', 'GENIE'), ('Casiguran', 'GENIE'), ('Prieto Diaz', 'GENIE'), ('Barcelona', 'GENIE'), ('Bulusan', 'GENIE'), ('Irosin', 'GENIE'),
    ('Juban', 'GRACE'), ('Magallanes', 'GRACE'), ('Bulan', 'GRACE'), ('Sta. Magdalena', 'GRACE'), ('Matnog', 'GRACE'),
    ('Ticao Island', 'MARK')
) as m (name, dsp_code)
join public.dsps d on d.code = m.dsp_code
on conflict do nothing;

-- Products (§6.1) -------------------------------------------------------------
insert into public.products (code, name, unit_price, unit_type, canisters_included, includes_stove, stove_count, sort_order)
values
  ('REFILL', 'Refill', 35.00, 'canister', 1, false, 0, 1),
  ('CANISTER', 'Canister', 75.00, 'canister', 1, false, 0, 2),
  ('STOVE_SET_399', 'Stove Set 399', 399.00, 'set', 1, true, 1, 3),
  ('STOVE_SET_599', 'Stove Set 599', 599.00, 'set', 3, true, 1, 4)
on conflict (code) do nothing;

-- Current-year KPI target (§3) -------------------------------------------------
insert into public.kpi_targets (year, accounts_target, volume_target_mt, notes)
values (extract(year from now())::int, 300, 14.45, 'Seeded from §3 business constants.')
on conflict (year) where dsp_id is null do nothing;
