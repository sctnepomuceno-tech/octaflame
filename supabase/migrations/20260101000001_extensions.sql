-- Extensions
create extension if not exists "pgcrypto" with schema extensions;

-- Shared updated_at trigger, used by every table with an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger that stamps updated_at = now(). Attach to any table with an updated_at column.';
