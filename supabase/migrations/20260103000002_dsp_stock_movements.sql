-- DSP rolling stock ledger (§6.4). Balance is always SUM(in) - SUM(out),
-- never a stored column (§4.1 #2).
create table public.dsp_stock_movements (
  id uuid primary key default gen_random_uuid(),
  dsp_id uuid not null references public.dsps (id),
  item_id uuid not null references public.inventory_items (id),
  quantity integer not null check (quantity > 0),
  direction text not null check (direction in ('in', 'out')),
  movement_type text not null check (
    movement_type in ('issued', 'sold', 'returned_to_warehouse', 'transfer_in', 'transfer_out', 'damaged', 'adjustment')
  ),
  movement_date date not null default current_date,
  reference_table text,
  reference_id uuid,
  reason text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint dsp_stock_movements_reason_required
    check (movement_type not in ('adjustment', 'damaged') or reason is not null)
);

create index dsp_stock_movements_dsp_item_idx on public.dsp_stock_movements (dsp_id, item_id);
create index dsp_stock_movements_reference_idx on public.dsp_stock_movements (reference_table, reference_id);

-- Balance view, never a stored column.
create view public.dsp_stock_balance as
select
  dsp_id,
  item_id,
  sum(case when direction = 'in' then quantity else -quantity end) as balance
from public.dsp_stock_movements
group by dsp_id, item_id;

alter table public.dsp_stock_movements enable row level security;

create policy dsp_stock_movements_select on public.dsp_stock_movements
  for select using (
    public.is_management()
    or public.has_permission('warehouse.read')
    or (dsp_id = public.current_dsp_id() and public.is_active_user())
  );

-- 'sold' is written only by the sale trigger (SECURITY DEFINER, below),
-- never inserted directly by a client for that movement_type.
create policy dsp_stock_movements_insert on public.dsp_stock_movements
  for insert with check (
    movement_type <> 'sold'
    and (
      public.is_management()
      or (public.has_permission('warehouse.create') and dsp_id = public.current_dsp_id())
      or public.has_permission('warehouse.adjust')
    )
  );

comment on table public.dsp_stock_movements is
  'Stock issued to a DSP has left the warehouse but is not yet sold — still company property, must be counted (§3.3).';

-- Auto-write the 'sold' movement from a sale's current total_canisters
-- (§6.4: "auto-written by trigger on sale insert" — kept in sync on every
-- item change, not just insert, so an edited sale's stock effect stays
-- correct). SECURITY DEFINER because the acting DSP's own RLS insert
-- policy explicitly excludes movement_type='sold' from direct client writes.
create or replace function public.sync_sold_stock_movement(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_canister_item_id uuid;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    return;
  end if;

  select id into v_canister_item_id
  from public.inventory_items
  where name = 'Canister (Full)';

  delete from public.dsp_stock_movements
  where reference_table = 'sales' and reference_id = p_sale_id and movement_type = 'sold';

  if v_sale.deleted_at is null and v_sale.total_canisters > 0 and v_canister_item_id is not null then
    insert into public.dsp_stock_movements (
      dsp_id, item_id, quantity, direction, movement_type, movement_date,
      reference_table, reference_id, created_by
    ) values (
      v_sale.dsp_id, v_canister_item_id, v_sale.total_canisters, 'out', 'sold', v_sale.sale_date,
      'sales', p_sale_id, v_sale.created_by
    );
  end if;
end;
$$;

-- Extend the existing sale_items recompute trigger (defined in
-- 20260102000004_sales.sql) to keep the 'sold' movement in sync too.
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
  end if;

  return null;
end;
$$;

-- Soft-deleting a sale header (no item churn) should also clear its sold
-- movement — extends 20260102000004_sales.sql's sales_after_header_change.
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
  return null;
end;
$$;
