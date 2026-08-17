-- Inventory item master list (§6.7). Created here in Phase 2.5 because the
-- stock ledgers below reference it; the Warehouse dashboard consuming it
-- fully is Phase 4.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('crate', 'canister', 'stove', 'other')),
  unit text not null default 'unit',
  reorder_level integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

create policy inventory_items_select on public.inventory_items
  for select using (public.is_active_user());

create policy inventory_items_write on public.inventory_items
  for all using (public.has_permission('products.manage') or public.is_management())
  with check (public.has_permission('products.manage') or public.is_management());

insert into public.inventory_items (name, category, unit, reorder_level)
values
  ('Crate', 'crate', 'crate', 50),
  ('Canister (Full)', 'canister', 'canister', 200),
  ('Canister (Empty Shell)', 'canister', 'canister', 100),
  ('Stove Set 399', 'stove', 'set', 20),
  ('Stove Set 599', 'stove', 'set', 20),
  ('LPG Regulator', 'other', 'unit', 30),
  ('Rubber Hose', 'other', 'unit', 30),
  ('Safety Seal', 'other', 'unit', 100)
on conflict do nothing;

comment on table public.inventory_items is
  'Master list of countable warehouse/DSP items. "Canister (Full)" is the item decremented by the sold movement (§6.4) — both REFILL and CANISTER products draw from it, since physically both leave the DSP as one full canister.';
