# Octaflame OS

Operations Management System for Octaflame — Fiesta Gas distributor,
Sorsogon Province. See `OCTAFLAME_OS_SPEC.md` (or the project brief you were
given) for the full product spec. This README covers local setup.

**Build status:** Phase 1 — Foundation (schema, RLS, auth, bootstrap, invite
flow, permission model, app shell). Later phases land incrementally.

## Stack

Next.js 15 (App Router) · TypeScript (strict) · TailwindCSS · shadcn/ui ·
Supabase (Postgres, Auth, RLS) · TanStack Query · react-hook-form + zod

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then in
**Authentication → Providers → Email**, turn **off** "Allow new users to
sign up" — public signup is permanently disabled (§5.5). Local dev config
already does this in `supabase/config.toml`.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=          # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=         # Project Settings → API — server-only, never expose to the browser
BOOTSTRAP_ADMIN_EMAIL=             # first Management account's email
BOOTSTRAP_ADMIN_PASSWORD=          # first Management account's password
```

Never commit `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` and
`BOOTSTRAP_ADMIN_PASSWORD` in particular must stay out of version control.

### 3. Run the migrations

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies `supabase/migrations/*.sql` — schema, RLS policies, and
reference-data seeding (DSPs, municipalities, products, settings, current
year's KPI target).

### 4. Bootstrap the first Management account

```bash
npm run bootstrap:admin
```

Idempotent and self-disabling (§5.5) — safe to run more than once; it does
nothing once any active Management account exists. The account is flagged
`must_change_password = true`, so the first login forces a password change
before anything else is reachable.

### 5. (Optional) Seed test users

```bash
npm run seed
```

Creates one test account per role — `management@octaflame.test`,
`dsp@octaflame.test`, `warehouse@octaflame.test`, `office@octaflame.test`,
`viewer@octaflame.test` — password `Octaflame!2026` (override with
`SEED_TEST_USER_PASSWORD`). Dev/staging only; refuses to run against
`NODE_ENV=production` unless `ALLOW_SEED_IN_PRODUCTION=true`.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks and lints) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bootstrap:admin` | One-time first Management account (§5.5) |
| `npm run seed` | Seed test users for every role (dev/staging only) |

## Project structure

```
src/app/(auth)/       Login, forced first-login password change — no app shell
src/app/(app)/        Everything behind auth — shares the permission-aware app shell
src/app/actions/      Server actions (auth, user invitations)
src/lib/supabase/     Browser/server/admin Supabase clients, hand-authored Database types
src/lib/permissions.ts  Single source of truth for permission keys, role templates, §5.10 dependency rules
src/lib/volume/       The one canister → kg → MT utility module (§7.1) — import this, never re-derive the math
src/lib/nav.ts         Declarative, permission-filtered navigation
supabase/migrations/   Schema + RLS, in order — the source of truth for the database
scripts/               bootstrap-admin.ts (§5.5), seed.ts (§17)
```

## Security model

RLS is enabled on every table and is the real access-control boundary —
server actions and the UI enforce the same rules again, but assume RLS is
what actually stops an unauthorized read or write (§4.1, §15). See
`supabase/migrations/20260101000009_rls_policies.sql` and
`20260101000008_profiles_lockout_guards.sql` for the policies and the
self-lockout / last-Management-account guards.
