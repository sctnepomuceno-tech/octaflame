-- Two-party warehouse -> DSP handover with acknowledgement (§6.4). Warehouse
-- says X left; the DSP confirms what actually arrived. truck_report_id is
-- added by the Phase 4 migration that creates truck_reports.
create sequence public.stock_issuance_no_seq start 1000;

create table public.stock_issuances (
  id uuid primary key default gen_random_uuid(),
  issuance_no text not null default ('ISS-' || lpad(nextval('public.stock_issuance_no_seq')::text, 6, '0')),
  dsp_id uuid not null references public.dsps (id),
  issued_by uuid references public.profiles (id),
  issue_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'disputed')),
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  dispute_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index stock_issuances_issuance_no_uniq on public.stock_issuances (issuance_no);
create index stock_issuances_dsp_id_idx on public.stock_issuances (dsp_id);
create index stock_issuances_status_idx on public.stock_issuances (status);

create trigger set_updated_at
  before update on public.stock_issuances
  for each row execute function public.set_updated_at();

create table public.stock_issuance_items (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null references public.stock_issuances (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  quantity_issued integer not null check (quantity_issued > 0),
  quantity_received integer,
  variance integer generated always as (coalesce(quantity_received, 0) - quantity_issued) stored,
  notes text
);

create index stock_issuance_items_issuance_id_idx on public.stock_issuance_items (issuance_id);

alter table public.stock_issuances enable row level security;
alter table public.stock_issuance_items enable row level security;

create policy stock_issuances_select on public.stock_issuances
  for select using (
    public.is_management()
    or public.has_permission('warehouse.read')
    or (dsp_id = public.current_dsp_id() and public.is_active_user())
  );

create policy stock_issuances_insert on public.stock_issuances
  for insert with check (public.has_permission('warehouse.create') or public.is_management());

-- Acknowledgement/dispute updates go through acknowledge_stock_issuance()
-- (SECURITY INVOKER, below) so the item rows and header update atomically;
-- this direct-update policy exists for defense in depth, not the normal path.
create policy stock_issuances_update on public.stock_issuances
  for update using (
    public.is_management()
    or public.has_permission('warehouse.create')
    or (dsp_id = public.current_dsp_id() and public.is_active_user())
  )
  with check (
    public.is_management()
    or public.has_permission('warehouse.create')
    or (dsp_id = public.current_dsp_id() and public.is_active_user())
  );

create policy stock_issuance_items_select on public.stock_issuance_items
  for select using (
    exists (
      select 1 from public.stock_issuances si
      where si.id = stock_issuance_items.issuance_id
        and (
          public.is_management()
          or public.has_permission('warehouse.read')
          or (si.dsp_id = public.current_dsp_id() and public.is_active_user())
        )
    )
  );

create policy stock_issuance_items_insert on public.stock_issuance_items
  for insert with check (
    exists (
      select 1 from public.stock_issuances si
      where si.id = stock_issuance_items.issuance_id
        and (public.has_permission('warehouse.create') or public.is_management())
    )
  );

create policy stock_issuance_items_update on public.stock_issuance_items
  for update using (
    exists (
      select 1 from public.stock_issuances si
      where si.id = stock_issuance_items.issuance_id
        and (
          public.is_management()
          or public.has_permission('warehouse.create')
          or (si.dsp_id = public.current_dsp_id() and public.is_active_user())
        )
    )
  )
  with check (
    exists (
      select 1 from public.stock_issuances si
      where si.id = stock_issuance_items.issuance_id
        and (
          public.is_management()
          or public.has_permission('warehouse.create')
          or (si.dsp_id = public.current_dsp_id() and public.is_active_user())
        )
    )
  );

-- Create an issuance + its items atomically (warehouse.create or management).
create or replace function public.create_stock_issuance(
  p_dsp_id uuid,
  p_issue_date date,
  p_notes text,
  -- array of {item_id, quantity_issued, notes}
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_issuance_id uuid;
  v_item jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An issuance needs at least one item.';
  end if;

  insert into public.stock_issuances (dsp_id, issued_by, issue_date, notes)
  values (p_dsp_id, auth.uid(), p_issue_date, p_notes)
  returning id into v_issuance_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.stock_issuance_items (issuance_id, item_id, quantity_issued, notes)
    values (
      v_issuance_id,
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity_issued')::int,
      nullif(v_item->>'notes', '')
    );
  end loop;

  return v_issuance_id;
end;
$$;

-- Acknowledge (or dispute) an issuance: records what actually arrived per
-- item, writes the corresponding 'issued' dsp_stock_movements, and marks
-- the header. quantity_received is what actually reconciles into rolling
-- stock — a variance is surfaced, never blocked (§7.6).
create or replace function public.acknowledge_stock_issuance(
  p_issuance_id uuid,
  -- array of {item_id, quantity_received}
  p_received jsonb,
  p_dispute_reason text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_issuance public.stock_issuances%rowtype;
  v_received jsonb;
  v_qty integer;
begin
  select * into v_issuance from public.stock_issuances where id = p_issuance_id;
  if not found then
    raise exception 'Issuance not found.';
  end if;
  if v_issuance.status <> 'pending' then
    raise exception 'Only a pending issuance can be acknowledged.';
  end if;

  for v_received in select * from jsonb_array_elements(p_received)
  loop
    v_qty := (v_received->>'quantity_received')::int;

    update public.stock_issuance_items
    set quantity_received = v_qty
    where issuance_id = p_issuance_id
      and item_id = (v_received->>'item_id')::uuid;

    if v_qty > 0 then
      insert into public.dsp_stock_movements (
        dsp_id, item_id, quantity, direction, movement_type, movement_date,
        reference_table, reference_id, created_by
      ) values (
        v_issuance.dsp_id, (v_received->>'item_id')::uuid, v_qty, 'in', 'issued', current_date,
        'stock_issuances', p_issuance_id, auth.uid()
      );
    end if;
  end loop;

  update public.stock_issuances
  set
    status = case when p_dispute_reason is not null then 'disputed' else 'acknowledged' end,
    acknowledged_by = auth.uid(),
    acknowledged_at = now(),
    dispute_reason = p_dispute_reason
  where id = p_issuance_id;
end;
$$;
