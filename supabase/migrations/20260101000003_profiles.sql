-- profiles extends auth.users (§6.1, §5).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text,
  role text not null check (role in ('management', 'dsp', 'warehouse', 'office', 'viewer')),
  dsp_id uuid references public.dsps (id),
  permissions text[] not null default '{}',
  active boolean not null default true,
  must_change_password boolean not null default false,
  invited_by uuid references public.profiles (id),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id),
  last_login_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A dsp-role user must own a territory (§5.7).
  constraint profiles_dsp_role_requires_dsp_id check (role <> 'dsp' or dsp_id is not null)
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- One active DSP user per territory (§5.7).
create unique index profiles_dsp_id_active_uniq
  on public.profiles (dsp_id)
  where role = 'dsp' and active = true;

create index profiles_role_idx on public.profiles (role);
create index profiles_dsp_id_idx on public.profiles (dsp_id);

comment on table public.profiles is
  'Extends auth.users. permissions is the granular per-user grant list (§5.2); role seeds its default template (§5.3).';
