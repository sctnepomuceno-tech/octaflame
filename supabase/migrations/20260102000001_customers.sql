-- Customers (§6.2). RLS and the DSP-scoping trigger are written before any
-- UI consumes this table (§4.1 #1).
create extension if not exists "pg_trgm" with schema extensions;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  owner_name text,
  contact_number text,
  customer_type text not null check (customer_type in ('HH', 'RTL', 'WS')),
  municipality_id uuid not null references public.municipalities (id),
  barangay text,
  address text,
  landmark text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  -- Denormalized from municipality for query speed, kept in sync by trigger (§6.2).
  dsp_id uuid references public.dsps (id),
  status text not null default 'prospect'
    check (status in ('prospect', 'newly_acquired', 'active', 'dormant', 'inactive')),
  notes text,

  -- Maintained by trigger on sale insert/update/delete (§6.2, wired in the sales migration).
  first_purchase_date date,
  latest_purchase_date date,
  total_transactions integer not null default 0,
  lifetime_canisters integer not null default 0,
  lifetime_volume_kg numeric(14, 3) not null default 0,
  lifetime_amount numeric(14, 2) not null default 0,
  average_purchase_amount numeric(14, 2) not null default 0,
  is_repeat_customer boolean not null default false,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- HH requires only a name (business or owner) + municipality; RTL/WS are
  -- the accounts counted toward the 300-account KPI, so they must be real
  -- and reachable (§6.2).
  constraint customers_requires_a_name check (business_name is not null or owner_name is not null),
  constraint customers_rtl_ws_requires_contact check (
    customer_type = 'HH'
    or (owner_name is not null and contact_number is not null and address is not null)
  )
);

create trigger set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Keep dsp_id in sync with the municipality's current DSP (§6.2). Historical
-- sales snapshot their own dsp_id independently, so this sync affects only
-- how a customer is scoped/found going forward, never past reports.
create or replace function public.customers_sync_dsp_id()
returns trigger
language plpgsql
as $$
begin
  select m.dsp_id into new.dsp_id
  from public.municipalities m
  where m.id = new.municipality_id;
  return new;
end;
$$;

create trigger customers_sync_dsp_id
  before insert or update of municipality_id on public.customers
  for each row execute function public.customers_sync_dsp_id();

create index customers_dsp_id_idx on public.customers (dsp_id) where deleted_at is null;
create index customers_municipality_id_idx on public.customers (municipality_id) where deleted_at is null;
create index customers_customer_type_idx on public.customers (customer_type) where deleted_at is null;
create index customers_status_idx on public.customers (status) where deleted_at is null;
-- Fuzzy duplicate-name guard (§6.2): trigram index for similarity() lookups
-- scoped to a municipality, used by the "possible duplicate" warning before save.
create index customers_business_name_trgm_idx on public.customers
  using gin (business_name extensions.gin_trgm_ops);
create index customers_owner_name_trgm_idx on public.customers
  using gin (owner_name extensions.gin_trgm_ops);

alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select using (
    deleted_at is null
    and (
      public.is_management()
      or public.has_permission('customers.read.all')
      or (public.has_permission('customers.read.own') and dsp_id = public.current_dsp_id())
    )
  );

create policy customers_insert on public.customers
  for insert with check (
    public.has_permission('customers.create')
    and (public.is_management() or dsp_id = public.current_dsp_id())
  );

create policy customers_update on public.customers
  for update using (
    public.is_management()
    or public.has_permission('customers.edit.all')
    or (public.has_permission('customers.edit.own') and dsp_id = public.current_dsp_id())
  )
  with check (
    public.is_management()
    or public.has_permission('customers.edit.all')
    or (public.has_permission('customers.edit.own') and dsp_id = public.current_dsp_id())
  );

comment on table public.customers is
  'RTL/WS rows here are the accounts counted toward the 300-account KPI (§7.2) once total_transactions >= 1.';
