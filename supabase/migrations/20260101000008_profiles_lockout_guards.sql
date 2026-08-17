-- Lockout guards (§5.2, §5.8, §5.9): enforced in the database so no later
-- phase can accidentally bypass them by skipping a server action.
create or replace function public.profiles_guard_lockouts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  remaining_management_count int;
begin
  -- A user editing their own row cannot demote themselves, deactivate
  -- themselves, or strip their own users.manage permission (§5.8 #4, §5.2).
  if acting_user_id is not null and acting_user_id = old.id then
    if old.role = 'management' and new.role <> 'management' then
      raise exception 'You cannot demote your own account.';
    end if;

    if old.active = true and new.active = false then
      raise exception 'You cannot deactivate your own account.';
    end if;

    if 'users.manage' = any(old.permissions)
      and not ('users.manage' = any(new.permissions)) then
      raise exception 'You cannot remove your own users.manage permission.';
    end if;
  end if;

  -- The last active management account (with users.manage) can never be
  -- deactivated, demoted, or stripped of users.manage — by anyone (§5.8 #5).
  if old.role = 'management'
    and old.active = true
    and 'users.manage' = any(old.permissions)
    and (
      new.role <> 'management'
      or new.active = false
      or not ('users.manage' = any(new.permissions))
    )
  then
    select count(*) into remaining_management_count
    from public.profiles
    where id <> old.id
      and role = 'management'
      and active = true
      and 'users.manage' = any(permissions);

    if remaining_management_count = 0 then
      raise exception 'At least one active Management account with users.manage must remain.';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_lockouts
  before update on public.profiles
  for each row execute function public.profiles_guard_lockouts();

comment on function public.profiles_guard_lockouts() is
  'Blocks self-demotion, self-deactivation, self-removal of users.manage, and removing the last active Management account.';
