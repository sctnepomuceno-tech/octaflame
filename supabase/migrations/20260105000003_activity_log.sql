-- Customer-facing chronological history (§6.10). Written only by trigger,
-- never by hand — distinct from audit_log, which is a security trail.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  activity_type text not null check (
    activity_type in ('customer_created', 'sale', 'task_created', 'task_completed', 'collateral_delivered', 'status_changed', 'note')
  ),
  activity_date timestamptz not null default now(),
  title text not null,
  description text,
  metadata jsonb,
  reference_table text,
  reference_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index activity_log_customer_id_idx on public.activity_log (customer_id, activity_date desc);
create index activity_log_reference_idx on public.activity_log (reference_table, reference_id);

alter table public.activity_log enable row level security;

create policy activity_log_select on public.activity_log
  for select using (
    exists (
      select 1 from public.customers c
      where c.id = activity_log.customer_id
        and (
          public.is_management()
          or public.has_permission('customers.read.all')
          or (public.has_permission('customers.read.own') and c.dsp_id = public.current_dsp_id())
        )
    )
  );

-- No client insert policy — every row comes from a SECURITY DEFINER trigger.

-- customer_created --------------------------------------------------------
create or replace function public.log_customer_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (customer_id, activity_type, activity_date, title, created_by)
  values (new.id, 'customer_created', new.created_at, 'Customer created', new.created_by);
  return new;
end;
$$;

create trigger log_customer_created
  after insert on public.customers
  for each row execute function public.log_customer_created();

-- status_changed -----------------------------------------------------------
create or replace function public.log_customer_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.activity_log (customer_id, activity_type, title, description)
    values (new.id, 'status_changed', 'Status changed', old.status || ' -> ' || new.status);
  end if;
  return new;
end;
$$;

create trigger log_customer_status_changed
  after update of status on public.customers
  for each row execute function public.log_customer_status_changed();

-- sale ----------------------------------------------------------------------
-- Kept in sync with the sale's current totals (delete + reinsert), the same
-- pattern as sync_sold_stock_movement — never duplicates as items change.
create or replace function public.log_sale_activity(p_sale_id uuid)
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

  delete from public.activity_log where reference_table = 'sales' and reference_id = p_sale_id;

  if v_sale.deleted_at is null and v_sale.total_canisters > 0 then
    insert into public.activity_log (
      customer_id, activity_type, activity_date, title, description, metadata, reference_table, reference_id, created_by
    ) values (
      v_sale.customer_id, 'sale', v_sale.sale_date::timestamptz,
      case when v_sale.is_repeat_purchase then 'Repeat purchase' else 'First purchase' end
        || ' · ' || v_sale.total_canisters || ' canisters',
      '₱' || v_sale.total_amount || ' · ' || v_sale.total_volume_kg || ' kg',
      jsonb_build_object('total_amount', v_sale.total_amount, 'total_volume_kg', v_sale.total_volume_kg),
      'sales', p_sale_id, v_sale.created_by
    );
  end if;
end;
$$;

-- task_created / task_completed --------------------------------------------
create or replace function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null then
    insert into public.activity_log (customer_id, activity_type, title, description, reference_table, reference_id, created_by)
    values (new.customer_id, 'task_created', 'Follow-up task created', new.title, 'tasks', new.id, new.assigned_by);
  end if;
  return new;
end;
$$;

create trigger log_task_created
  after insert on public.tasks
  for each row execute function public.log_task_created();

create or replace function public.log_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and new.status = 'completed' and old.status <> 'completed' then
    insert into public.activity_log (customer_id, activity_type, title, description, reference_table, reference_id)
    values (new.customer_id, 'task_completed', 'Task completed', new.title, 'tasks', new.id);
  end if;
  return new;
end;
$$;

create trigger log_task_completed
  after update of status on public.tasks
  for each row execute function public.log_task_completed();

-- collateral_delivered -------------------------------------------------------
create or replace function public.log_collateral_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_name text;
begin
  if new.assigned_to_customer_id is not null and new.movement_type = 'out' then
    select name into v_item_name from public.collateral_items where id = new.item_id;
    insert into public.activity_log (customer_id, activity_type, title, description, reference_table, reference_id, created_by)
    values (
      new.assigned_to_customer_id, 'collateral_delivered', 'Marketing collateral delivered',
      new.quantity || ' ' || coalesce(v_item_name, 'item'), 'collateral_movements', new.id, new.created_by
    );
  end if;
  return new;
end;
$$;

create trigger log_collateral_delivered
  after insert on public.collateral_movements
  for each row execute function public.log_collateral_delivered();

-- Wire the sale activity log into the existing recompute trigger chain
-- (defined across 20260102000004_sales.sql, 20260103000002, 20260103000004).
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
    perform public.log_sale_activity(v_sale_id);
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
  perform public.log_sale_activity(new.id);
  return null;
end;
$$;
