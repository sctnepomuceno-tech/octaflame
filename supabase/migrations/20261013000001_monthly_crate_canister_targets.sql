-- Switch volume KPI tracking from a single annual MT target to monthly
-- canister-pcs targets (crates are canisters_target / canisters_per_crate,
-- derived at display time — no separate crates column needed). The annual
-- row keeps only the accounts target now; its "volume" is an overview
-- computed by summing that year's monthly canisters_target values.
alter table public.kpi_targets
  add column canisters_target integer check (canisters_target >= 0);

alter table public.kpi_targets alter column volume_target_mt drop not null;
alter table public.kpi_targets alter column accounts_target drop not null;

-- Annual row: accounts target raised to 500; volume_target_mt retired (the
-- annual volume figure is now a computed overview, not a stored target).
update public.kpi_targets
set accounts_target = 500, volume_target_mt = null
where year = 2026 and month is null and dsp_id is null;

-- Seed the monthly canister targets confirmed for 2026.
insert into public.kpi_targets (year, month, dsp_id, canisters_target, notes)
values
  (2026, 6, null, 36000, 'Monthly volume KPI: 1500 crates (24 canisters/crate).'),
  (2026, 7, null, 36000, 'Monthly volume KPI: 1500 crates (24 canisters/crate).'),
  (2026, 8, null, 48000, 'Monthly volume KPI: 2000 crates (24 canisters/crate).'),
  (2026, 9, null, 48000, 'Monthly volume KPI: 2000 crates (24 canisters/crate).'),
  (2026, 10, null, 48000, 'Monthly volume KPI: 2000 crates (24 canisters/crate).'),
  (2026, 11, null, 60000, 'Monthly volume KPI: 2500 crates (24 canisters/crate).'),
  (2026, 12, null, 84000, 'Monthly volume KPI: 3500 crates (24 canisters/crate).');
