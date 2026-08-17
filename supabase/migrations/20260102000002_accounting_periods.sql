-- Minimal accounting_periods (§6.6), just enough for sales entry to block
-- writes into a closed period (§9.1 #1). The close/reopen workflow and
-- pre-checks (§7.10) are Phase 6 — no period ever closes until that UI
-- ships, so this is a structural gate, not yet a working feature.
create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles (id),
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create trigger set_updated_at
  before update on public.accounting_periods
  for each row execute function public.set_updated_at();

create or replace function public.is_period_open(p_date date)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.accounting_periods
    where year = extract(year from p_date)::int
      and month = extract(month from p_date)::int
      and status = 'closed'
  );
$$;

alter table public.accounting_periods enable row level security;

create policy accounting_periods_select on public.accounting_periods
  for select using (public.is_active_user());

create policy accounting_periods_write on public.accounting_periods
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());
