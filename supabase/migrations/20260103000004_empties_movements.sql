-- The reverse loop, tracked at every holder (§6.5). Balances are always
-- derived views, never stored columns (§4.1 #2). A single real-world event
-- that moves empties between two holders (e.g. a DSP collecting shells
-- from a customer) is written as two rows — one per holder — inside one
-- RPC call, the same pattern as create_sale/acknowledge_stock_issuance.
create table public.empties_movements (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('canister_shell', 'crate')),
  quantity integer not null check (quantity > 0),
  holder_type text not null check (holder_type in ('customer', 'dsp', 'warehouse')),
  holder_id uuid not null,
  direction text not null check (direction in ('in', 'out')),
  movement_type text not null check (
    movement_type in (
      'collected_from_customer', 'owed_by_customer', 'returned_by_customer',
      'dsp_to_warehouse', 'warehouse_to_plant', 'lost', 'damaged', 'adjustment'
    )
  ),
  movement_date date not null default current_date,
  reference_table text,
  reference_id uuid,
  reason text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint empties_movements_reason_required
    check (movement_type not in ('adjustment', 'lost', 'damaged') or reason is not null)
);

create index empties_movements_holder_idx on public.empties_movements (holder_type, holder_id, item_type);
create index empties_movements_reference_idx on public.empties_movements (reference_table, reference_id);

-- Derived balances (§6.5) — never stored columns.
create view public.empties_balance as
select
  holder_type,
  holder_id,
  item_type,
  sum(case when direction = 'in' then quantity else -quantity end) as balance
from public.empties_movements
group by holder_type, holder_id, item_type;

create view public.customer_empties_balance as
select holder_id as customer_id, item_type, balance
from public.empties_balance
where holder_type = 'customer';

create view public.dsp_empties_balance as
select holder_id as dsp_id, item_type, balance
from public.empties_balance
where holder_type = 'dsp';

create view public.warehouse_empties_balance as
select holder_id as warehouse_id, item_type, balance
from public.empties_balance
where holder_type = 'warehouse';

alter table public.empties_movements enable row level security;

create policy empties_movements_select on public.empties_movements
  for select using (
    public.is_management()
    or public.has_permission('warehouse.read')
    or (
      holder_type = 'customer'
      and exists (
        select 1 from public.customers c
        where c.id = empties_movements.holder_id
          and (
            public.has_permission('customers.read.all')
            or (public.has_permission('customers.read.own') and c.dsp_id = public.current_dsp_id())
          )
      )
    )
    or (holder_type = 'dsp' and holder_id = public.current_dsp_id() and public.is_active_user())
  );

-- All writes go through record_empties_collection() / owed-on-sale /
-- Phase 4's warehouse-transfer RPCs (SECURITY DEFINER where the acting
-- user's own scope wouldn't otherwise cover both sides of a transfer).
-- No direct client insert policy — mirrors dsp_stock_movements' treatment
-- of 'sold'.

comment on table public.empties_movements is
  'Every empty shell and crate must be accounted for at the customer, DSP, or warehouse tier (Definition of Done). Written only by RPCs, never inserted directly.';

-- Write the customer-side "owed" leg whenever a sale leaves a shortfall
-- (§7.6: empties_expected - empties_collected = shortfall -> customer
-- empties balance). Runs from the same trigger chain that recomputes sale
-- totals, so it's always in sync with the sale's current empties_variance.
create or replace function public.sync_owed_empties_movement(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    return;
  end if;

  delete from public.empties_movements
  where reference_table = 'sales' and reference_id = p_sale_id and movement_type = 'owed_by_customer';

  if v_sale.deleted_at is null and v_sale.empties_variance > 0 then
    insert into public.empties_movements (
      item_type, quantity, holder_type, holder_id, direction, movement_type,
      movement_date, reference_table, reference_id, created_by
    ) values (
      'canister_shell', v_sale.empties_variance, 'customer', v_sale.customer_id, 'in', 'owed_by_customer',
      v_sale.sale_date, 'sales', p_sale_id, v_sale.created_by
    );
  end if;
end;
$$;

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
    perform public.sync_sold_stock_movement(v_sale_id);
    perform public.sync_owed_empties_movement(v_sale_id);
  end if;

  return null;
end;
$$;

create or replace function public.sales_after_header_change()
returns trigger
language plpgsql
as $$
begin
  if old.customer_id is distinct from new.customer_id then
    perform public.recompute_customer_stats(old.customer_id);
  end if;
  perform public.recompute_customer_stats(new.customer_id);
  perform public.sync_sold_stock_movement(new.id);
  perform public.sync_owed_empties_movement(new.id);
  return null;
end;
$$;

-- Record a DSP collecting empties from a customer outside of a sale (e.g.
-- a standalone visit) — writes both legs atomically: the customer's owed
-- balance goes down, the DSP's held-empties balance goes up.
create or replace function public.record_empties_collection(
  p_customer_id uuid,
  p_item_type text,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dsp_id uuid;
  v_authorized boolean;
begin
  select dsp_id into v_dsp_id from public.customers where id = p_customer_id;
  if v_dsp_id is null then
    raise exception 'Customer not found.';
  end if;

  select
    public.is_management()
    or (public.has_permission('customers.edit.own') and v_dsp_id = public.current_dsp_id())
    or public.has_permission('customers.edit.all')
  into v_authorized;

  if not v_authorized then
    raise exception 'Not authorized.';
  end if;

  insert into public.empties_movements (item_type, quantity, holder_type, holder_id, direction, movement_type, notes, created_by)
  values (p_item_type, p_quantity, 'customer', p_customer_id, 'out', 'returned_by_customer', p_notes, auth.uid());

  insert into public.empties_movements (item_type, quantity, holder_type, holder_id, direction, movement_type, notes, created_by)
  values (p_item_type, p_quantity, 'dsp', v_dsp_id, 'in', 'collected_from_customer', p_notes, auth.uid());
end;
$$;
