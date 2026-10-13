-- Add canisters_target (sum of the year's monthly canister targets, or
-- this exact month's target) to company_kpi_progress and
-- company_kpi_progress_monthly, alongside the existing accounts/volume_mt
-- fields — callers move to the new field, the old ones just go unused.
--
-- Applied directly against production via rename-then-recreate rather than
-- DROP + CREATE OR REPLACE: DROP FUNCTION on this project hung every time
-- it was tried (through both apply_migration and execute_sql), while
-- ALTER FUNCTION ... RENAME and CREATE were both instant. The orphaned
-- *_old functions this left behind are harmless dead code, nothing
-- references them, and are included here only as a record of the rename —
-- a future cleanup can DROP them once/if that hang stops reproducing.
alter function if exists public.company_kpi_progress(integer) rename to company_kpi_progress_old;
alter function if exists public.company_kpi_progress_monthly(integer, integer) rename to company_kpi_progress_monthly_old;

create function public.company_kpi_progress(p_year integer default extract(year from now())::int)
returns table (
  year integer,
  accounts_target integer,
  volume_target_mt numeric,
  canisters_target integer,
  total_accounts integer,
  total_volume_kg numeric,
  total_volume_mt numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p_year,
    (select kt.accounts_target from public.kpi_targets kt where kt.year = p_year and kt.month is null and kt.dsp_id is null),
    (select kt.volume_target_mt from public.kpi_targets kt where kt.year = p_year and kt.month is null and kt.dsp_id is null),
    (select sum(kt.canisters_target)::int from public.kpi_targets kt where kt.year = p_year and kt.month is not null and kt.dsp_id is null),
    (
      select count(*)::int
      from public.customers c
      where c.customer_type in ('RTL', 'WS')
        and c.total_transactions >= 1
        and c.deleted_at is null
        and extract(year from c.first_purchase_date)::int = p_year
    ) as total_accounts,
    coalesce((
      select sum(s.total_volume_kg)
      from public.sales s
      where s.deleted_at is null
        and extract(year from s.sale_date)::int = p_year
    ), 0) as total_volume_kg,
    coalesce((
      select sum(s.total_volume_mt)
      from public.sales s
      where s.deleted_at is null
        and extract(year from s.sale_date)::int = p_year
    ), 0) as total_volume_mt;
end;
$$;

comment on function public.company_kpi_progress(integer) is
  'Company-wide aggregate only — never returns row-level sales/customer data. canisters_target is the sum of that year''s monthly targets (the annual volume figure is an overview, not a stored target). Safe to call from any active user regardless of dsp_id scope.';

create function public.company_kpi_progress_monthly(
  p_year integer default extract(year from now())::int,
  p_month integer default extract(month from now())::int
)
returns table (
  year integer,
  month integer,
  accounts_target integer,
  volume_target_mt numeric,
  canisters_target integer,
  total_accounts integer,
  total_volume_kg numeric,
  total_volume_mt numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p_year,
    p_month,
    kt.accounts_target,
    kt.volume_target_mt,
    kt.canisters_target,
    (
      select count(*)::int
      from public.customers c
      where c.customer_type in ('RTL', 'WS')
        and c.total_transactions >= 1
        and c.deleted_at is null
        and extract(year from c.first_purchase_date)::int = p_year
        and extract(month from c.first_purchase_date)::int = p_month
    ) as total_accounts,
    coalesce((
      select sum(s.total_volume_kg)
      from public.sales s
      where s.deleted_at is null
        and extract(year from s.sale_date)::int = p_year
        and extract(month from s.sale_date)::int = p_month
    ), 0) as total_volume_kg,
    coalesce((
      select sum(s.total_volume_mt)
      from public.sales s
      where s.deleted_at is null
        and extract(year from s.sale_date)::int = p_year
        and extract(month from s.sale_date)::int = p_month
    ), 0) as total_volume_mt
  from public.kpi_targets kt
  where kt.year = p_year and kt.month = p_month and kt.dsp_id is null;
end;
$$;

comment on function public.company_kpi_progress_monthly(integer, integer) is
  'Company-wide monthly aggregate only — never returns row-level sales/customer data. canisters_target is this month''s real target. Returns no rows when that month has no target set.';
