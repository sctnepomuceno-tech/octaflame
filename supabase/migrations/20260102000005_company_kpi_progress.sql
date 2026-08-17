-- Company-wide KPI progress (§3, §7.2, §7.4). SECURITY DEFINER so every
-- active user — including a DSP scoped to their own rows by RLS — can see
-- the company-wide gauge on their dashboard (§8.2 "progress to company KPI
-- with their contribution highlighted") without this function ever
-- exposing another DSP's row-level sales or customer data. Only aggregate
-- totals are returned.
create or replace function public.company_kpi_progress(p_year integer default extract(year from now())::int)
returns table (
  year integer,
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
    kt.accounts_target,
    kt.volume_target_mt,
    -- §7.2: an account counts once, in the year of first purchase.
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
    ), 0) as total_volume_mt
  from public.kpi_targets kt
  where kt.year = p_year and kt.dsp_id is null;
end;
$$;

comment on function public.company_kpi_progress(integer) is
  'Company-wide aggregate only — never returns row-level sales/customer data. Safe to call from any active user regardless of dsp_id scope.';
