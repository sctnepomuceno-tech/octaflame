-- Marketing collateral (§6.8). Same ledger discipline as everything else —
-- balance is a view, never a stored column.
create table public.collateral_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  unit text not null default 'unit',
  reorder_level integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.collateral_items
  for each row execute function public.set_updated_at();

insert into public.collateral_items (name, category, reorder_level)
values
  ('Stick-out Sign', 'signage', 10),
  ('Poster', 'signage', 20),
  ('Tarpaulin', 'signage', 10),
  ('Streamer', 'signage', 10),
  ('Cap', 'apparel', 30),
  ('Bag', 'apparel', 30),
  ('Apron', 'apparel', 20),
  ('Umbrella', 'apparel', 15)
on conflict do nothing;

create table public.collateral_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.collateral_items (id),
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment', 'return')),
  quantity integer not null check (quantity > 0),
  direction text not null check (direction in ('in', 'out')),
  movement_date date not null default current_date,
  assigned_to_dsp_id uuid references public.dsps (id),
  assigned_to_municipality_id uuid references public.municipalities (id),
  assigned_to_customer_id uuid references public.customers (id),
  received_by text,
  reference_no text,
  reason text,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint collateral_movements_reason_required
    check (movement_type <> 'adjustment' or reason is not null)
);

create index collateral_movements_item_id_idx on public.collateral_movements (item_id);
create index collateral_movements_dsp_idx on public.collateral_movements (assigned_to_dsp_id);
create index collateral_movements_date_idx on public.collateral_movements (movement_date);

create view public.collateral_balance as
select
  item_id,
  sum(case when direction = 'in' then quantity else -quantity end) as balance
from public.collateral_movements
group by item_id;

create view public.collateral_dsp_allocation as
select
  assigned_to_dsp_id as dsp_id,
  item_id,
  extract(year from movement_date)::int as year,
  sum(quantity) as quantity
from public.collateral_movements
where movement_type = 'out' and assigned_to_dsp_id is not null
group by assigned_to_dsp_id, item_id, extract(year from movement_date);

alter table public.collateral_items enable row level security;
alter table public.collateral_movements enable row level security;

create policy collateral_items_select on public.collateral_items
  for select using (public.is_active_user());

create policy collateral_items_write on public.collateral_items
  for all using (public.has_permission('products.manage') or public.is_management())
  with check (public.has_permission('products.manage') or public.is_management());

create policy collateral_movements_select on public.collateral_movements
  for select using (
    public.is_management()
    or public.has_permission('office.read')
    or (assigned_to_dsp_id = public.current_dsp_id() and public.is_active_user())
  );

create policy collateral_movements_insert on public.collateral_movements
  for insert with check (
    public.is_management()
    or public.has_permission('office.create')
    or public.has_permission('office.adjust')
  );

comment on table public.collateral_movements is
  'assigned_to_dsp_id is how "Allocation by DSP (YTD)" (§8.4) and a DSP''s own read-only visibility into their allocations (§5.3) both work.';
