-- Monthly KPI targets (extends §3/§7.2/§7.4's annual-only kpi_targets).
-- month is nullable: null keeps meaning "the annual target" (unchanged
-- behavior for every existing row and for company_kpi_progress()); 1-12
-- is an optional override for that specific month, editable from
-- Settings > KPI Targets and surfaced on the Management dashboard.
alter table public.kpi_targets
  add column month integer check (month between 1 and 12);

-- Replace the old (year) / (year, dsp_id) uniqueness with a version that
-- also accounts for month, using coalesce so the single annual row (month
-- is null) still collides with itself but not with any monthly override.
drop index public.kpi_targets_company_year_uniq;
drop index public.kpi_targets_dsp_year_uniq;

create unique index kpi_targets_company_year_month_uniq
  on public.kpi_targets (year, coalesce(month, 0))
  where dsp_id is null;

create unique index kpi_targets_dsp_year_month_uniq
  on public.kpi_targets (year, dsp_id, coalesce(month, 0))
  where dsp_id is not null;

-- Company-wide monthly KPI progress, mirroring company_kpi_progress()'s
-- security posture (SECURITY DEFINER, aggregate-only, any active user can
-- call it). Returns zero rows when no monthly override exists for that
-- year/month — callers treat that as "no monthly target set" rather than
-- an error.
create or replace function public.company_kpi_progress_monthly(
  p_year integer default extract(year from now())::int,
  p_month integer default extract(month from now())::int
)
returns table (
  year integer,
  month integer,
  accounts_target integer,
  volume_target_mt numeric,
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
  'Company-wide monthly aggregate only — never returns row-level sales/customer data. Returns no rows when that month has no target override set.';
