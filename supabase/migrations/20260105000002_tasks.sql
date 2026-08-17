-- Tasks (§6.9). A task links to at least one of customer/municipality/dsp/sale.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type_id uuid references public.task_types (id),

  assigned_to uuid not null references public.profiles (id),
  assigned_by uuid not null references public.profiles (id),

  customer_id uuid references public.customers (id),
  municipality_id uuid references public.municipalities (id),
  dsp_id uuid references public.dsps (id),
  sale_id uuid references public.sales (id),

  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  tags text[] not null default '{}',

  completed_at timestamptz,
  completion_notes text,
  cancelled_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_links_to_something
    check (customer_id is not null or municipality_id is not null or dsp_id is not null or sale_id is not null)
);

create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_assigned_by_idx on public.tasks (assigned_by);
create index tasks_customer_id_idx on public.tasks (customer_id);
create index tasks_dsp_id_idx on public.tasks (dsp_id);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_status_idx on public.tasks (status);

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Stamp completed_at the moment status flips to completed, cleared if reopened.
create or replace function public.tasks_stamp_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_stamp_completed_at
  before update on public.tasks
  for each row execute function public.tasks_stamp_completed_at();

alter table public.tasks enable row level security;

-- Visible to assigned_to, assigned_by, and anyone with tasks.read.all (§6.9).
create policy tasks_select on public.tasks
  for select using (
    public.is_management()
    or public.has_permission('tasks.read.all')
    or assigned_to = auth.uid()
    or assigned_by = auth.uid()
  );

-- Assigning to someone else requires tasks.assign; assigning to yourself
-- just needs tasks.create (§5.2).
create policy tasks_insert on public.tasks
  for insert with check (
    (public.has_permission('tasks.create') or public.is_management())
    and (assigned_to = auth.uid() or public.has_permission('tasks.assign') or public.is_management())
    and assigned_by = auth.uid()
  );

create policy tasks_update on public.tasks
  for update using (
    public.is_management()
    or public.has_permission('tasks.edit.all')
    or (public.has_permission('tasks.edit.own') and (assigned_to = auth.uid() or assigned_by = auth.uid()))
  )
  with check (
    public.is_management()
    or public.has_permission('tasks.edit.all')
    or (public.has_permission('tasks.edit.own') and (assigned_to = auth.uid() or assigned_by = auth.uid()))
  );
