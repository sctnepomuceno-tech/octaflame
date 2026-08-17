-- Sales header + line items (§6.3). Header totals are never trusted from
-- the client — they're recomputed from sale_items by trigger, the same
-- "ledgers, not balances" discipline applied to derived aggregates (§4.1 #2).

create sequence public.sales_receipt_no_seq start 1000;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  -- Required for RTL/WS, null for HH — enforced below.
  deployment_date date,

  customer_id uuid not null references public.customers (id),
  -- Snapshots (§4.1 #5): historical reports must never shift when a
  -- customer's type or territory changes later.
  customer_type text not null check (customer_type in ('HH', 'RTL', 'WS')),
  municipality_id uuid not null references public.municipalities (id),
  dsp_id uuid not null references public.dsps (id),

  total_amount numeric(14, 2) not null default 0,
  total_canisters integer not null default 0,
  total_crates integer not null default 0,
  total_volume_kg numeric(14, 3) not null default 0,
  total_volume_mt numeric(14, 6) not null default 0,
  is_repeat_purchase boolean not null default false,

  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  amount_paid numeric(14, 2) not null default 0,

  -- Exchange (§3.3, §7.6).
  empties_expected integer not null default 0,
  empties_collected integer not null default 0,
  empties_variance integer not null default 0,
  crates_returned_by_customer integer not null default 0,

  -- Duplicate protection (§7.9): generated client-side when the form opens.
  client_ref uuid not null,
  synced_at timestamptz not null default now(),
  receipt_no text not null default ('OCT-' || lpad(nextval('public.sales_receipt_no_seq')::text, 6, '0')),

  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint sales_deployment_date_required_for_rtl_ws
    check (customer_type = 'HH' or deployment_date is not null)
);

create unique index sales_client_ref_uniq on public.sales (client_ref);
create unique index sales_receipt_no_uniq on public.sales (receipt_no);
create index sales_dsp_id_idx on public.sales (dsp_id) where deleted_at is null;
create index sales_customer_id_idx on public.sales (customer_id) where deleted_at is null;
create index sales_sale_date_idx on public.sales (sale_date) where deleted_at is null;

create trigger set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- Block writes into a closed accounting period (§9.1 #1, §7.10).
create or replace function public.sales_guard_period()
returns trigger
language plpgsql
as $$
begin
  if not public.is_period_open(new.sale_date) then
    raise exception 'The accounting period for % is closed.', new.sale_date;
  end if;
  return new;
end;
$$;

create trigger sales_guard_period
  before insert or update of sale_date on public.sales
  for each row execute function public.sales_guard_period();

-- is_repeat_purchase (§6.3): did this customer have a prior sale as of this one.
create or replace function public.sales_set_is_repeat_purchase()
returns trigger
language plpgsql
as $$
begin
  select exists (
    select 1 from public.sales
    where customer_id = new.customer_id
      and deleted_at is null
      and (sale_date < new.sale_date or (sale_date = new.sale_date and created_at < now()))
  ) into new.is_repeat_purchase;
  return new;
end;
$$;

create trigger sales_set_is_repeat_purchase
  before insert on public.sales
  for each row execute function public.sales_set_is_repeat_purchase();

-- Sale line items ------------------------------------------------------
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),

  qty_crates integer not null default 0 check (qty_crates >= 0),
  qty_canisters integer not null default 0 check (qty_canisters >= 0),
  qty_sets integer not null default 0 check (qty_sets >= 0),

  -- Snapshot of products.unit_price at time of sale (§4.1 #5).
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null default 0,
  line_canisters integer not null default 0,
  line_volume_kg numeric(14, 3) not null default 0,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sale_items_at_least_one_qty
    check (qty_crates > 0 or qty_canisters > 0 or qty_sets > 0)
);

create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

create trigger set_updated_at
  before update on public.sale_items
  for each row execute function public.set_updated_at();

-- Compute line_canisters / line_volume_kg / line_total (§7.1). Must mirror
-- src/lib/volume/calculations.ts's lineCanisters/lineVolumeKg exactly.
create or replace function public.sale_items_compute()
returns trigger
language plpgsql
as $$
declare
  v_canisters_per_crate numeric := coalesce(public.setting_number('canisters_per_crate'), 24);
  v_kg_per_canister numeric := coalesce(public.setting_number('kg_per_canister'), 0.17);
  v_product public.products%rowtype;
begin
  select * into v_product from public.products where id = new.product_id;
  if not found then
    raise exception 'Unknown product_id %', new.product_id;
  end if;

  new.line_canisters := round(
    (new.qty_crates * v_canisters_per_crate)
    + new.qty_canisters
    + (new.qty_sets * v_product.canisters_included)
  );
  new.line_volume_kg := new.line_canisters * v_kg_per_canister;

  new.line_total := case v_product.unit_type
    when 'set' then new.unit_price * new.qty_sets
    when 'crate' then new.unit_price * new.qty_crates
    else new.unit_price * new.line_canisters
  end;

  return new;
end;
$$;

create trigger sale_items_compute
  before insert or update on public.sale_items
  for each row execute function public.sale_items_compute();

-- Recompute the parent sale's header totals from its line items, and the
-- customer's lifetime stats from their sales, every time items change.
create or replace function public.sales_recompute_from_items()
returns trigger
language plpgsql
as $$
declare
  v_sale_id uuid := coalesce(new.sale_id, old.sale_id);
  v_customer_id uuid;
begin
  update public.sales s
  set
    total_amount = agg.total_amount,
    total_canisters = agg.total_canisters,
    total_crates = agg.total_crates,
    total_volume_kg = agg.total_volume_kg,
    total_volume_mt = agg.total_volume_kg / 1000,
    empties_expected = agg.empties_expected,
    empties_variance = agg.empties_expected - s.empties_collected
  from (
    select
      coalesce(sum(si.line_total), 0) as total_amount,
      coalesce(sum(si.line_canisters), 0) as total_canisters,
      coalesce(sum(si.qty_crates), 0) as total_crates,
      coalesce(sum(si.line_volume_kg), 0) as total_volume_kg,
      coalesce(sum(si.line_canisters) filter (where p.code = 'REFILL'), 0) as empties_expected
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = v_sale_id
  ) agg
  where s.id = v_sale_id
  returning s.customer_id into v_customer_id;

  if v_customer_id is not null then
    perform public.recompute_customer_stats(v_customer_id);
  end if;

  return null;
end;
$$;

create trigger sale_items_after_change
  after insert or update or delete on public.sale_items
  for each row execute function public.sales_recompute_from_items();

-- Customer lifetime stats + status (§6.2, §7.3). Re-aggregates from scratch
-- every call — simple and always correct, never drifts.
create or replace function public.recompute_customer_stats(p_customer_id uuid)
returns void
language plpgsql
as $$
declare
  v_newly_acquired_days int := coalesce(public.setting_number('customer_status_newly_acquired_days'), 30);
  v_active_days int := coalesce(public.setting_number('customer_status_active_days'), 60);
  v_dormant_days int := coalesce(public.setting_number('customer_status_dormant_days'), 120);
  v_stats record;
  v_status text;
begin
  select
    min(sale_date) as first_purchase_date,
    max(sale_date) as latest_purchase_date,
    count(*) as total_transactions,
    coalesce(sum(total_canisters), 0) as lifetime_canisters,
    coalesce(sum(total_volume_kg), 0) as lifetime_volume_kg,
    coalesce(sum(total_amount), 0) as lifetime_amount
  into v_stats
  from public.sales
  where customer_id = p_customer_id and deleted_at is null;

  if v_stats.total_transactions = 0 then
    v_status := 'prospect';
  elsif v_stats.first_purchase_date >= current_date - v_newly_acquired_days then
    v_status := 'newly_acquired';
  elsif v_stats.latest_purchase_date >= current_date - v_active_days then
    v_status := 'active';
  elsif v_stats.latest_purchase_date >= current_date - v_dormant_days then
    v_status := 'dormant';
  else
    v_status := 'inactive';
  end if;

  update public.customers
  set
    first_purchase_date = v_stats.first_purchase_date,
    latest_purchase_date = v_stats.latest_purchase_date,
    total_transactions = v_stats.total_transactions,
    lifetime_canisters = v_stats.lifetime_canisters,
    lifetime_volume_kg = v_stats.lifetime_volume_kg,
    lifetime_amount = v_stats.lifetime_amount,
    average_purchase_amount = case when v_stats.total_transactions > 0
      then v_stats.lifetime_amount / v_stats.total_transactions else 0 end,
    is_repeat_customer = v_stats.total_transactions >= 2,
    status = v_status
  where id = p_customer_id;
end;
$$;

-- Soft-deleting or reassigning a sale (header-only changes, no item churn)
-- still needs to recompute the affected customer(s) (§7.8: returns/edits
-- reverse KPI numbers, never a raw delete).
create or replace function public.sales_after_header_change()
returns trigger
language plpgsql
as $$
begin
  if old.customer_id is distinct from new.customer_id then
    perform public.recompute_customer_stats(old.customer_id);
  end if;
  perform public.recompute_customer_stats(new.customer_id);
  return null;
end;
$$;

create trigger sales_after_header_change
  after update of deleted_at, customer_id on public.sales
  for each row execute function public.sales_after_header_change();

-- RLS --------------------------------------------------------------------
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy sales_select on public.sales
  for select using (
    deleted_at is null
    and (
      public.is_management()
      or public.has_permission('sales.read.all')
      or (public.has_permission('sales.read.own') and dsp_id = public.current_dsp_id())
    )
  );

create policy sales_insert on public.sales
  for insert with check (
    public.is_management()
    or (public.has_permission('sales.create') and dsp_id = public.current_dsp_id())
  );

create policy sales_update on public.sales
  for update using (
    public.is_management()
    or public.has_permission('sales.edit.all')
    or public.has_permission('sales.delete')
    or (public.has_permission('sales.edit.own') and dsp_id = public.current_dsp_id())
  )
  with check (
    public.is_management()
    or public.has_permission('sales.edit.all')
    or public.has_permission('sales.delete')
    or (public.has_permission('sales.edit.own') and dsp_id = public.current_dsp_id())
  );

create policy sale_items_select on public.sale_items
  for select using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and s.deleted_at is null
        and (
          public.is_management()
          or public.has_permission('sales.read.all')
          or (public.has_permission('sales.read.own') and s.dsp_id = public.current_dsp_id())
        )
    )
  );

create policy sale_items_insert on public.sale_items
  for insert with check (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (
          public.is_management()
          or (public.has_permission('sales.create') and s.dsp_id = public.current_dsp_id())
        )
    )
  );

create policy sale_items_update on public.sale_items
  for update using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (
          public.is_management()
          or public.has_permission('sales.edit.all')
          or (public.has_permission('sales.edit.own') and s.dsp_id = public.current_dsp_id())
        )
    )
  )
  with check (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (
          public.is_management()
          or public.has_permission('sales.edit.all')
          or (public.has_permission('sales.edit.own') and s.dsp_id = public.current_dsp_id())
        )
    )
  );

create policy sale_items_delete on public.sale_items
  for delete using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (
          public.is_management()
          or public.has_permission('sales.edit.all')
          or (public.has_permission('sales.edit.own') and s.dsp_id = public.current_dsp_id())
        )
    )
  );

comment on table public.sales is
  'Never hard-deleted (§15.4) — no DELETE policy exists. Corrections are edits (period open) or returns (Phase 2.5), never a raw delete.';
