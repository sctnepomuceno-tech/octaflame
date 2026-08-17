-- user_invitations — §5.6.
create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check (role in ('management', 'dsp', 'warehouse', 'office', 'viewer')),
  dsp_id uuid references public.dsps (id),
  permissions text[] not null default '{}',
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_invitations_dsp_role_requires_dsp_id check (role <> 'dsp' or dsp_id is not null)
);

create trigger set_updated_at
  before update on public.user_invitations
  for each row execute function public.set_updated_at();

-- Only one live (pending) invitation per email at a time.
create unique index user_invitations_pending_email_uniq
  on public.user_invitations (lower(email))
  where status = 'pending';

create index user_invitations_status_idx on public.user_invitations (status);
