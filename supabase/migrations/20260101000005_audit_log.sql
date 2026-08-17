-- audit_log — append-only, §6.12 / §15.7.
-- Nobody, including Management, may edit or delete an entry (enforced in RLS
-- migration: no update/delete policy exists for any role).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  action text not null,
  table_name text not null,
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_user_id_idx on public.audit_log (user_id);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
