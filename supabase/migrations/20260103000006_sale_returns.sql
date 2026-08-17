-- Returns and damaged goods (§7.8). A DSP never deletes a sale to fix a
-- mistake — this is how corrections happen instead. quantity is always in
-- canister-equivalents (the same denominator line_canisters already uses,
-- so this works uniformly for crate/canister/set-priced lines).
create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  sale_item_id uuid not null references public.sale_items (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  return_type text not null check (return_type in ('damaged', 'leaking', 'wrong_item', 'customer_return', 'expired')),
  restockable boolean not null default false,
  refund_amount numeric(12, 2) not null default 0,
  return_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index sale_returns_sale_id_idx on public.sale_returns (sale_id);
create index sale_returns_return_date_idx on public.sale_returns (return_date);

alter table public.sale_returns enable row level security;

create policy sale_returns_select on public.sale_returns
  for select using (
    exists (
      select 1 from public.sales s
      where s.id = sale_returns.sale_id
        and (
          public.is_management()
          or public.has_permission('sales.read.all')
          or (public.has_permission('sales.read.own') and s.dsp_id = public.current_dsp_id())
        )
    )
  );

-- Writes go through create_sale_return() (SECURITY DEFINER — it also
-- touches dsp_stock_movements, which the caller's own scope wouldn't
-- necessarily cover for a plain client insert).

-- Reverses volume/revenue/canisters from KPI calculations, dated to the
-- return date rather than the original sale date (§7.8), and restocks
-- restockable units to DSP rolling stock. Damaged units are not restocked
-- — they already left DSP stock via the original 'sold' movement.
create or replace function public.create_sale_return(
  p_sale_item_id uuid,
  p_quantity integer,
  p_return_type text,
  p_restockable boolean,
  p_refund_amount numeric,
  p_return_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_item public.sale_items%rowtype;
  v_sale public.sales%rowtype;
  v_already_returned integer;
  v_return_id uuid;
  v_canister_item_id uuid;
  v_authorized boolean;
begin
  select * into v_sale_item from public.sale_items where id = p_sale_item_id;
  if not found then
    raise exception 'Sale line not found.';
  end if;

  select * into v_sale from public.sales where id = v_sale_item.sale_id;

  select
    public.is_management()
    or public.has_permission('sales.edit.all')
    or (public.has_permission('sales.edit.own') and v_sale.dsp_id = public.current_dsp_id())
  into v_authorized;

  if not v_authorized then
    raise exception 'Not authorized.';
  end if;

  select coalesce(sum(quantity), 0) into v_already_returned
  from public.sale_returns
  where sale_item_id = p_sale_item_id;

  if v_already_returned + p_quantity > v_sale_item.line_canisters then
    raise exception 'Cannot return more than was sold on this line.';
  end if;

  insert into public.sale_returns (
    sale_id, sale_item_id, product_id, quantity, return_type, restockable,
    refund_amount, return_date, notes, created_by, approved_by
  ) values (
    v_sale_item.sale_id, p_sale_item_id, v_sale_item.product_id, p_quantity, p_return_type, p_restockable,
    p_refund_amount, p_return_date, p_notes, auth.uid(), auth.uid()
  ) returning id into v_return_id;

  if p_restockable then
    select id into v_canister_item_id from public.inventory_items where name = 'Canister (Full)';
    if v_canister_item_id is not null then
      insert into public.dsp_stock_movements (
        dsp_id, item_id, quantity, direction, movement_type, movement_date,
        reference_table, reference_id, reason, created_by
      ) values (
        v_sale.dsp_id, v_canister_item_id, p_quantity, 'in', 'adjustment', p_return_date,
        'sale_returns', v_return_id, 'Restockable sale return', auth.uid()
      );
    end if;
  end if;

  return v_return_id;
end;
$$;

-- Company-wide KPI progress, netted against returns dated within the year
-- (§7.8: dated to the return date, so a return in January never reopens a
-- December-dated sale — it simply reduces January's totals).
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
    ), 0) - coalesce((
      select sum(sr.quantity) * public.setting_number('kg_per_canister')
      from public.sale_returns sr
      where extract(year from sr.return_date)::int = p_year
    ), 0) as total_volume_kg,
    (
      coalesce((
        select sum(s.total_volume_kg)
        from public.sales s
        where s.deleted_at is null
          and extract(year from s.sale_date)::int = p_year
      ), 0) - coalesce((
        select sum(sr.quantity) * public.setting_number('kg_per_canister')
        from public.sale_returns sr
        where extract(year from sr.return_date)::int = p_year
      ), 0)
    ) / 1000 as total_volume_mt
  from public.kpi_targets kt
  where kt.year = p_year and kt.dsp_id is null;
end;
$$;
