-- Task types (§6.9), Management-configurable.
create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#94a3b8',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.task_types
  for each row execute function public.set_updated_at();

insert into public.task_types (name, color, sort_order)
values
  ('Customer Follow-up', '#f59e0b', 1),
  ('Repeat Deployment', '#3b82f6', 2),
  ('Sales Visit', '#10b981', 3),
  ('Collection of Empty Crates', '#8b5cf6', 4),
  ('Deliver Marketing Collateral', '#ec4899', 5),
  ('Inventory Check', '#06b6d4', 6),
  ('Product Demonstration', '#84cc16', 7),
  ('Account Activation', '#f97316', 8),
  ('New Account Prospecting', '#6366f1', 9),
  ('Complaint Resolution', '#ef4444', 10),
  ('Site Inspection', '#14b8a6', 11),
  ('Other', '#94a3b8', 12)
on conflict do nothing;

alter table public.task_types enable row level security;

create policy task_types_select on public.task_types
  for select using (public.is_active_user());

create policy task_types_write on public.task_types
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());
