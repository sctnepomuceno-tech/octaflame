-- Physical stock counts (§7.7). scope='warehouse' is accepted by the schema
-- now for forward-compatibility, but only scope='dsp' writes adjustment
-- movements on approval until Phase 4 adds the warehouse-side ledger.
create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('dsp', 'warehouse')),
  scope_id uuid not null,
  count_date date not null default current_date,
  counted_by uuid references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_counts_scope_idx on public.stock_counts (scope, scope_id);

create trigger set_updated_at
  before update on public.stock_counts
  for each row execute function public.set_updated_at();

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  -- Snapshot at submit time (§7.7).
  system_quantity integer not null default 0,
  counted_quantity integer,
  variance integer generated always as (coalesce(counted_quantity, 0) - system_quantity) stored,
  reason text,
  notes text
);

create index stock_count_items_count_id_idx on public.stock_count_items (count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

create policy stock_counts_select on public.stock_counts
  for select using (
    public.is_management()
    or public.has_permission('warehouse.read')
    or (scope = 'dsp' and scope_id = public.current_dsp_id() and public.is_active_user())
  );

create policy stock_counts_write on public.stock_counts
  for all using (
    public.is_management()
    or public.has_permission('warehouse.adjust')
    or (scope = 'dsp' and scope_id = public.current_dsp_id() and public.has_permission('warehouse.read'))
  )
  with check (
    public.is_management()
    or public.has_permission('warehouse.adjust')
    or (scope = 'dsp' and scope_id = public.current_dsp_id() and public.has_permission('warehouse.read'))
  );

create policy stock_count_items_select on public.stock_count_items
  for select using (
    exists (
      select 1 from public.stock_counts sc
      where sc.id = stock_count_items.count_id
        and (
          public.is_management()
          or public.has_permission('warehouse.read')
          or (sc.scope = 'dsp' and sc.scope_id = public.current_dsp_id() and public.is_active_user())
        )
    )
  );

create policy stock_count_items_write on public.stock_count_items
  for all using (
    exists (
      select 1 from public.stock_counts sc
      where sc.id = stock_count_items.count_id
        and (
          public.is_management()
          or public.has_permission('warehouse.adjust')
          or (sc.scope = 'dsp' and sc.scope_id = public.current_dsp_id() and public.has_permission('warehouse.read'))
        )
    )
  )
  with check (
    exists (
      select 1 from public.stock_counts sc
      where sc.id = stock_count_items.count_id
        and (
          public.is_management()
          or public.has_permission('warehouse.adjust')
          or (sc.scope = 'dsp' and sc.scope_id = public.current_dsp_id() and public.has_permission('warehouse.read'))
        )
    )
  );

-- Start a count: snapshots current system_quantity (dsp scope: dsp_stock_balance).
create or replace function public.start_stock_count(
  p_scope text,
  p_scope_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_count_id uuid;
begin
  insert into public.stock_counts (scope, scope_id, counted_by, notes)
  values (p_scope, p_scope_id, auth.uid(), p_notes)
  returning id into v_count_id;

  if p_scope = 'dsp' then
    insert into public.stock_count_items (count_id, item_id, system_quantity)
    select v_count_id, ii.id, coalesce(b.balance, 0)
    from public.inventory_items ii
    left join public.dsp_stock_balance b on b.item_id = ii.id and b.dsp_id = p_scope_id
    where ii.active = true;
  end if;

  return v_count_id;
end;
$$;

-- Submit counted quantities (array of {item_id, counted_quantity, reason, notes}).
create or replace function public.submit_stock_count(p_count_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.stock_count_items
    set
      counted_quantity = (v_item->>'counted_quantity')::int,
      reason = nullif(v_item->>'reason', ''),
      notes = nullif(v_item->>'notes', '')
    where count_id = p_count_id and item_id = (v_item->>'item_id')::uuid;
  end loop;

  update public.stock_counts set status = 'submitted' where id = p_count_id;
end;
$$;

-- Approve a count: writes an 'adjustment' movement per item with a
-- non-zero variance, bringing the ledger in line (§7.7). Only Management
-- approves counts with variance beyond the threshold, enforced in the
-- server action layer (needs the configurable threshold from settings).
create or replace function public.approve_stock_count(p_count_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_count public.stock_counts%rowtype;
  v_item record;
begin
  select * into v_count from public.stock_counts where id = p_count_id;
  if not found or v_count.status <> 'submitted' then
    raise exception 'Only a submitted count can be approved.';
  end if;

  if v_count.scope = 'dsp' then
    for v_item in
      select * from public.stock_count_items
      where count_id = p_count_id and variance <> 0 and counted_quantity is not null
    loop
      insert into public.dsp_stock_movements (
        dsp_id, item_id, quantity, direction, movement_type, movement_date,
        reference_table, reference_id, reason, created_by
      ) values (
        v_count.scope_id, v_item.item_id, abs(v_item.variance),
        case when v_item.variance > 0 then 'in' else 'out' end,
        'adjustment', current_date, 'stock_counts', p_count_id,
        coalesce(v_item.reason, 'Stock count adjustment'), auth.uid()
      );
    end loop;
  end if;

  update public.stock_counts
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_count_id;
end;
$$;

-- Three-way reconciliation (§7.6): ledger balance vs. the most recent
-- approved physical count, per DSP and item. Variance is surfaced, never
-- blocked.
create or replace view public.dsp_stock_reconciliation as
select
  b.dsp_id,
  b.item_id,
  b.balance as ledger_balance,
  latest.counted_quantity as last_physical_count,
  latest.count_date as last_count_date,
  case when latest.counted_quantity is not null then b.balance - latest.counted_quantity end as variance
from public.dsp_stock_balance b
left join lateral (
  select sci.counted_quantity, sc.count_date
  from public.stock_count_items sci
  join public.stock_counts sc on sc.id = sci.count_id
  where sc.scope = 'dsp'
    and sc.scope_id = b.dsp_id
    and sc.status = 'approved'
    and sci.item_id = b.item_id
    and sci.counted_quantity is not null
  order by sc.approved_at desc
  limit 1
) latest on true;
