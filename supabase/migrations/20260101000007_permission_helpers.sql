-- Permission-check helper functions (§5, §15).
-- SECURITY DEFINER so RLS policies (including on profiles itself) can call
-- them without recursing into the RLS they're used to enforce.

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and perm = any(permissions)
  );
$$;

create or replace function public.is_management()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'management'
      and active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active = true
  );
$$;

create or replace function public.current_dsp_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select dsp_id from public.profiles where id = auth.uid();
$$;

comment on function public.has_permission(text) is
  'True if the current authenticated user is active and holds the given permission key (§5.2).';
comment on function public.is_management() is
  'True if the current authenticated user is an active management user. Management implicitly has full access.';
comment on function public.current_dsp_id() is
  'The dsp_id of the current authenticated user, or null if not a dsp user. Never trust a client-supplied dsp_id on write (§4.1).';
