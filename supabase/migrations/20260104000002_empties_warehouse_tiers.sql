-- Completes the §6.5 empties ledger across all three tiers (deferred from
-- Phase 2.5): a DSP returning collected empties to the warehouse, and the
-- warehouse returning shells to the plant.
--
-- There is no `warehouses` table (only one warehouse exists in MVP scope),
-- so holder_type='warehouse' rows use a fixed singleton id, matching the
-- nil UUID convention. Keep this constant in sync with
-- src/lib/warehouse.ts's WAREHOUSE_HOLDER_ID on the TypeScript side.
create or replace function public.dsp_to_warehouse_transfer(
  p_dsp_id uuid,
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
  v_authorized boolean;
begin
  select public.is_management() or (public.has_permission('warehouse.create') and p_dsp_id = public.current_dsp_id())
    or public.has_permission('warehouse.read')
  into v_authorized;

  if not v_authorized then
    raise exception 'Not authorized.';
  end if;

  insert into public.empties_movements (item_type, quantity, holder_type, holder_id, direction, movement_type, notes, created_by)
  values (p_item_type, p_quantity, 'dsp', p_dsp_id, 'out', 'dsp_to_warehouse', p_notes, auth.uid());

  insert into public.empties_movements (item_type, quantity, holder_type, holder_id, direction, movement_type, notes, created_by)
  values (p_item_type, p_quantity, 'warehouse', '00000000-0000-0000-0000-000000000000'::uuid, 'in', 'dsp_to_warehouse', p_notes, auth.uid());
end;
$$;

create or replace function public.warehouse_to_plant_transfer(
  p_item_type text,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_management() or public.has_permission('warehouse.adjust')) then
    raise exception 'Not authorized.';
  end if;

  insert into public.empties_movements (item_type, quantity, holder_type, holder_id, direction, movement_type, notes, created_by)
  values (p_item_type, p_quantity, 'warehouse', '00000000-0000-0000-0000-000000000000'::uuid, 'out', 'warehouse_to_plant', p_notes, auth.uid());
end;
$$;

-- Note: empties_movements_select (Phase 2.5) already grants warehouse.read
-- holders full visibility regardless of holder_type, so 'warehouse' holder
-- rows are already covered — no policy change needed here.
