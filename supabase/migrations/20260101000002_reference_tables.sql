-- Reference / master data tables (§6.1).
-- Business constants live in `settings` so they can change without a redeploy.

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  data_type text not null check (data_type in ('string', 'number', 'boolean', 'json')),
  label text not null,
  description text,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

comment on table public.settings is 'Business constants (§3), editable without a redeploy.';

-- DSPs -----------------------------------------------------------------
-- No user_id column here: ownership resolves from profiles.dsp_id (§5.7).
create table public.dsps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.dsps
  for each row execute function public.set_updated_at();

-- Municipalities ---------------------------------------------------------
-- Attach to a DSP record, not a person. Reassignment affects only future
-- transactions — historical sales keep their snapshotted dsp_id (§5.7).
create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dsp_id uuid references public.dsps (id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.municipalities
  for each row execute function public.set_updated_at();

create index municipalities_dsp_id_idx on public.municipalities (dsp_id);

-- Barangays ----------------------------------------------------------------
-- Optional address depth. Seeded empty; users may add free-text initially.
create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.barangays
  for each row execute function public.set_updated_at();

create index barangays_municipality_id_idx on public.barangays (municipality_id);

-- Products -------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unit_type text not null check (unit_type in ('canister', 'crate', 'set')),
  canisters_included integer not null default 1 check (canisters_included >= 0),
  includes_stove boolean not null default false,
  stove_count integer not null default 0 check (stove_count >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Price history ----------------------------------------------------------
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index price_history_product_id_idx on public.price_history (product_id);

-- KPI targets ------------------------------------------------------------
-- Scope is company-wide in MVP: dsp_id stays null. The column exists so
-- per-DSP targets can be added later without a migration (§6.1).
create table public.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  dsp_id uuid references public.dsps (id),
  accounts_target integer not null check (accounts_target >= 0),
  volume_target_mt numeric(12, 3) not null check (volume_target_mt >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.kpi_targets
  for each row execute function public.set_updated_at();

-- Exactly one company-wide (dsp_id is null) target row per year.
create unique index kpi_targets_company_year_uniq
  on public.kpi_targets (year)
  where dsp_id is null;

create unique index kpi_targets_dsp_year_uniq
  on public.kpi_targets (year, dsp_id)
  where dsp_id is not null;
