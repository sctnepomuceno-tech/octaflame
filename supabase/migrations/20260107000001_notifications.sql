-- Phase 7 §13: in-app notifications. Event-driven triggers cover the
-- discrete-event rules (assignment, completion, large orders, low stock,
-- pending issuances, a customer going inactive). The date/threshold-based
-- rules (task due today, task overdue, KPI milestones) have no event to
-- hang off — there is no cron/Edge Function runner in this stack — so
-- run_scheduled_notification_checks() below is called opportunistically
-- from the app shell on every page load instead (idempotent, cheap, and
-- "in-app only for MVP" per spec means near-real-time is enough).
--
-- truck_overdue is deliberately NOT implemented: nothing in the schema
-- defines when a truck run becomes "overdue" (no scheduled/expected date
-- exists on truck_reports), so any threshold here would be invented rather
-- than derived from the spec. The rule row still exists so it's visible
-- and toggleable in the notification settings screen, just inert.

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  threshold numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.notification_rules
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  rule_key text not null references public.notification_rules (rule_key),
  title text not null,
  body text,
  link text,
  reference_table text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_dedup_idx on public.notifications (rule_key, reference_table, reference_id);

alter table public.notification_rules enable row level security;
alter table public.notifications enable row level security;

create policy notification_rules_select on public.notification_rules
  for select using (public.is_active_user());

create policy notification_rules_write on public.notification_rules
  for all using (public.has_permission('notifications.manage') or public.is_management())
  with check (public.has_permission('notifications.manage') or public.is_management());

create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

-- Mark-as-read only — no client insert policy. Every row is written by a
-- SECURITY DEFINER trigger/function below (mirrors activity_log's pattern).
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.notification_rules (rule_key, label, description, threshold) values
  ('low_inventory', 'Low inventory', 'A DSP''s stock for an item drops below its reorder level.', null),
  ('kpi_milestone', 'KPI milestones', 'Company progress crosses 25/50/75/90/100% of the annual target.', null),
  ('inactive_customer', 'Inactive customers', 'A customer''s status changes to inactive.', null),
  ('large_order', 'Large orders', 'A single sale exceeds this amount.', 5000),
  ('pending_inventory', 'Pending inventory', 'A new stock issuance is waiting on a DSP to acknowledge it.', null),
  ('truck_overdue', 'Truck overdue', 'A scheduled truck run has not been logged. Not implemented — no schedule exists in the data model yet.', null),
  ('task_due_today', 'Task due today', 'A task assigned to you is due today.', null),
  ('task_overdue', 'Task overdue', 'A task assigned to you is past its due date.', null),
  ('task_newly_assigned', 'Newly assigned task', 'A task has been assigned to you.', null),
  ('task_completed', 'Task completed', 'A task you assigned has been completed.', null);

create or replace function public.notification_rule_enabled(p_rule_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.notification_rules where rule_key = p_rule_key), true);
$$;

-- task_newly_assigned ---------------------------------------------------------
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.notification_rule_enabled('task_newly_assigned') then
    return new;
  end if;
  if new.assigned_to = new.assigned_by then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assigned_to = new.assigned_to then
    return new;
  end if;
  insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
  values (new.assigned_to, 'task_newly_assigned', 'New task assigned', new.title, '/tasks', 'tasks', new.id);
  return new;
end;
$$;

create trigger notify_task_assigned
  after insert or update of assigned_to on public.tasks
  for each row execute function public.notify_task_assigned();

-- task_completed (to assigner) -------------------------------------------------
create or replace function public.notify_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.notification_rule_enabled('task_completed') then
    return new;
  end if;
  if new.status = 'completed' and old.status is distinct from 'completed' and new.assigned_by <> new.assigned_to then
    insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
    values (new.assigned_by, 'task_completed', 'Task completed', new.title, '/tasks', 'tasks', new.id);
  end if;
  return new;
end;
$$;

create trigger notify_task_completed
  after update of status on public.tasks
  for each row execute function public.notify_task_completed();

-- low_inventory (DSP-side balance only, for MVP scope) -------------------------
create or replace function public.notify_low_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_reorder int;
  v_item_name text;
  v_dsp_user_id uuid;
begin
  if not public.notification_rule_enabled('low_inventory') then
    return new;
  end if;
  select balance into v_balance from public.dsp_stock_balance where dsp_id = new.dsp_id and item_id = new.item_id;
  select reorder_level, name into v_reorder, v_item_name from public.inventory_items where id = new.item_id;
  if v_balance is null or v_reorder is null or v_balance >= v_reorder then
    return new;
  end if;
  select id into v_dsp_user_id from public.profiles where dsp_id = new.dsp_id and role = 'dsp' and active = true limit 1;
  if v_dsp_user_id is not null then
    insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
    values (v_dsp_user_id, 'low_inventory', 'Low on ' || v_item_name, 'Balance: ' || v_balance, '/stock/issuances', 'inventory_items', new.item_id);
  end if;
  return new;
end;
$$;

create trigger notify_low_inventory
  after insert on public.dsp_stock_movements
  for each row execute function public.notify_low_inventory();

-- pending_inventory -------------------------------------------------------------
create or replace function public.notify_pending_issuance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dsp_user_id uuid;
begin
  if not public.notification_rule_enabled('pending_inventory') then
    return new;
  end if;
  if new.status <> 'pending' then
    return new;
  end if;
  select id into v_dsp_user_id from public.profiles where dsp_id = new.dsp_id and role = 'dsp' and active = true limit 1;
  if v_dsp_user_id is not null then
    insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
    values (v_dsp_user_id, 'pending_inventory', 'Stock issuance awaiting acknowledgement', new.issuance_no, '/stock/issuances', 'stock_issuances', new.id);
  end if;
  return new;
end;
$$;

create trigger notify_pending_issuance
  after insert on public.stock_issuances
  for each row execute function public.notify_pending_issuance();

-- large_order ---------------------------------------------------------------
create or replace function public.notify_large_order(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_threshold numeric;
  v_management_id uuid;
begin
  if not public.notification_rule_enabled('large_order') then
    return;
  end if;
  select threshold into v_threshold from public.notification_rules where rule_key = 'large_order';
  select * into v_sale from public.sales where id = p_sale_id;
  if not found or v_sale.deleted_at is not null or v_sale.total_amount < coalesce(v_threshold, 5000) then
    return;
  end if;
  if exists (select 1 from public.notifications where rule_key = 'large_order' and reference_table = 'sales' and reference_id = p_sale_id) then
    return;
  end if;
  for v_management_id in select id from public.profiles where role = 'management' and active = true loop
    insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
    values (v_management_id, 'large_order', 'Large order recorded', '₱' || v_sale.total_amount, '/sales/' || p_sale_id, 'sales', p_sale_id);
  end loop;
end;
$$;

-- Wire into the existing sale recompute trigger chain (20260102000004,
-- 20260103000002, 20260103000004, 20260105000003) — same CREATE OR REPLACE
-- extension pattern used every time this chain has grown a new side effect.
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
    perform public.notify_large_order(v_sale_id);
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
  perform public.notify_large_order(new.id);
  return null;
end;
$$;

-- inactive_customer -----------------------------------------------------------
-- Extends log_customer_status_changed (20260105000003) with a notification
-- side effect, same CREATE OR REPLACE pattern.
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

    if new.status = 'inactive' and public.notification_rule_enabled('inactive_customer') then
      insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
      select p.id, 'inactive_customer', 'Customer went inactive', coalesce(new.business_name, new.owner_name, 'Customer'), '/customers/' || new.id, 'customers', new.id
      from public.profiles p
      where p.active = true and (p.role = 'management' or p.dsp_id = new.dsp_id);
    end if;
  end if;
  return new;
end;
$$;

-- Scheduled-style checks, run opportunistically from the app shell ------------
create or replace function public.run_scheduled_notification_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_task record;
  v_year int := extract(year from current_date)::int;
  v_kpi record;
  v_milestone int;
  v_management_id uuid;
begin
  if public.notification_rule_enabled('task_due_today') then
    for v_task in
      select t.id, t.title, t.assigned_to from public.tasks t
      where t.due_date = v_today and t.status in ('pending', 'in_progress')
        and not exists (
          select 1 from public.notifications n
          where n.rule_key = 'task_due_today' and n.reference_table = 'tasks' and n.reference_id = t.id
            and n.created_at::date = v_today
        )
    loop
      insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
      values (v_task.assigned_to, 'task_due_today', 'Task due today', v_task.title, '/tasks', 'tasks', v_task.id);
    end loop;
  end if;

  if public.notification_rule_enabled('task_overdue') then
    for v_task in
      select t.id, t.title, t.assigned_to from public.tasks t
      where t.due_date < v_today and t.status in ('pending', 'in_progress')
        and not exists (
          select 1 from public.notifications n
          where n.rule_key = 'task_overdue' and n.reference_table = 'tasks' and n.reference_id = t.id
            and n.created_at::date = v_today
        )
    loop
      insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
      values (v_task.assigned_to, 'task_overdue', 'Task overdue', v_task.title, '/tasks', 'tasks', v_task.id);
    end loop;
  end if;

  if public.notification_rule_enabled('kpi_milestone') then
    select * into v_kpi from public.company_kpi_progress(v_year);
    if found and v_kpi.volume_target_mt > 0 then
      foreach v_milestone in array array[25, 50, 75, 90, 100]
      loop
        if (v_kpi.total_volume_mt / v_kpi.volume_target_mt) * 100 >= v_milestone
          and not exists (
            select 1 from public.notifications
            where rule_key = 'kpi_milestone' and body = v_year || '-' || v_milestone
          )
        then
          for v_management_id in select id from public.profiles where role = 'management' and active = true loop
            insert into public.notifications (user_id, rule_key, title, body, link, reference_table, reference_id)
            values (v_management_id, 'kpi_milestone', v_milestone || '% of the annual KPI reached', v_year || '-' || v_milestone, '/', null, null);
          end loop;
        end if;
      end loop;
    end if;
  end if;
end;
$$;

comment on function public.run_scheduled_notification_checks() is
  'Date/threshold-based notification rules with no discrete trigger event. Safe to call from any active user — idempotent, side effects only touch the relevant recipients. Called opportunistically from the app shell on page load in lieu of a cron scheduler.';
