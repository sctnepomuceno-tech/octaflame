-- Warehouse-level stock ledger (§6.7). Balance is always SUM(in)-SUM(out)
-- via a view, never a stored column (§4.1 #2). Unlike dsp_stock_movements,
-- an explicit direction column is still used (not left implicit by
-- movement_type alone) so 'adjustment' and 'transfer' aren't ambiguous.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id),
  movement_type text not null check (movement_type in ('in', 'out', 'transfer', 'adjustment', 'return')),
  quantity integer not null check (quantity > 0),
  direction text not null check (direction in ('in', 'out')),
  movement_date date not null default current_date,
  source text,
  destination_dsp_id uuid references public.dsps (id),
  destination_municipality_id uuid references public.municipalities (id),
  truck_report_id uuid,
  reference_no text,
  reason text,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint stock_movements_reason_required
    check (movement_type <> 'adjustment' or reason is not null)
);

create index stock_movements_item_id_idx on public.stock_movements (item_id);
create index stock_movements_movement_date_idx on public.stock_movements (movement_date);
create index stock_movements_truck_report_idx on public.stock_movements (truck_report_id);

create view public.warehouse_stock_balance as
select
  item_id,
  sum(case when direction = 'in' then quantity else -quantity end) as balance
from public.stock_movements
group by item_id;

alter table public.stock_movements enable row level security;

create policy stock_movements_select on public.stock_movements
  for select using (public.is_management() or public.has_permission('warehouse.read'));

create policy stock_movements_insert on public.stock_movements
  for insert with check (
    public.is_management()
    or public.has_permission('warehouse.create')
    or public.has_permission('warehouse.adjust')
  );

comment on table public.stock_movements is
  'Warehouse-level ledger — distinct from dsp_stock_movements. Issuing to a DSP decrements this at issuance creation (goods physically left) while the DSP side increments at acknowledgement (quantity actually confirmed received).';

-- Truck reports (§6.7).
create table public.truck_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null default current_date,
  truck_plate text,
  driver_name text,
  helper_name text,
  dsp_id uuid references public.dsps (id),
  destination_municipality_ids uuid[] not null default '{}',
  crates_out integer not null default 0,
  crates_returned integer not null default 0,
  empty_crates_collected integer not null default 0,
  stoves_out integer not null default 0,
  stoves_returned integer not null default 0,
  fuel_cost numeric(12, 2) not null default 0,
  odometer_start integer,
  odometer_end integer,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index truck_reports_report_date_idx on public.truck_reports (report_date);
create index truck_reports_dsp_id_idx on public.truck_reports (dsp_id);

create trigger set_updated_at
  before update on public.truck_reports
  for each row execute function public.set_updated_at();

alter table public.truck_reports enable row level security;

create policy truck_reports_select on public.truck_reports
  for select using (public.is_management() or public.has_permission('truck.read'));

create policy truck_reports_insert on public.truck_reports
  for insert with check (public.is_management() or public.has_permission('truck.create'));

create policy truck_reports_update on public.truck_reports
  for update using (public.is_management() or public.has_permission('truck.create'))
  with check (public.is_management() or public.has_permission('truck.create'));

-- Deferred FK from Phase 2.5 (stock_issuances predates truck_reports).
alter table public.stock_issuances
  add column truck_report_id uuid references public.truck_reports (id);

-- Extend create_stock_issuance (from 20260103000003) to also decrement the
-- warehouse-level ledger at issuance creation — goods physically left the
-- warehouse then, regardless of what the DSP later confirms receiving.
create or replace function public.create_stock_issuance(
  p_dsp_id uuid,
  p_issue_date date,
  p_notes text,
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

    insert into public.stock_movements (
      item_id, movement_type, quantity, direction, movement_date,
      destination_dsp_id, reference_no, created_by
    ) values (
      (v_item->>'item_id')::uuid, 'out', (v_item->>'quantity_issued')::int, 'out', p_issue_date,
      p_dsp_id, (select issuance_no from public.stock_issuances where id = v_issuance_id), auth.uid()
    );
  end loop;

  return v_issuance_id;
end;
$$;

-- Record stock received into the warehouse from the plant (§6.7).
create or replace function public.record_warehouse_stock_in(
  p_item_id uuid,
  p_quantity integer,
  p_source text,
  p_reference_no text,
  p_remarks text
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.stock_movements (item_id, movement_type, quantity, direction, source, reference_no, remarks, created_by)
  values (p_item_id, 'in', p_quantity, 'in', p_source, p_reference_no, p_remarks, auth.uid());
end;
$$;

-- Warehouse-side adjustment, mirroring dsp_stock_movements' pattern.
create or replace function public.record_warehouse_adjustment(
  p_item_id uuid,
  p_quantity integer,
  p_direction text,
  p_reason text,
  p_remarks text
)
returns void
language plpgsql
security invoker
as $$
begin
  if not (public.is_management() or public.has_permission('warehouse.adjust')) then
    raise exception 'Not authorized.';
  end if;

  insert into public.stock_movements (item_id, movement_type, quantity, direction, reason, remarks, created_by)
  values (p_item_id, 'adjustment', p_quantity, p_direction, p_reason, p_remarks, auth.uid());
end;
$$;
