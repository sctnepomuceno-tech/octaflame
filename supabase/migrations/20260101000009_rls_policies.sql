-- Row Level Security (§4.1 #1, §15). Written before any UI consumes these
-- tables. Deactivated users lose access immediately — every policy gates on
-- is_active_user(), not just on holding a valid session.

alter table public.settings enable row level security;
alter table public.dsps enable row level security;
alter table public.municipalities enable row level security;
alter table public.barangays enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.profiles enable row level security;
alter table public.user_invitations enable row level security;
alter table public.audit_log enable row level security;

-- settings -------------------------------------------------------------
create policy settings_select on public.settings
  for select using (public.is_active_user());

create policy settings_write on public.settings
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());

-- dsps -------------------------------------------------------------------
create policy dsps_select on public.dsps
  for select using (public.is_active_user());

create policy dsps_write on public.dsps
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());

-- municipalities -----------------------------------------------------------
create policy municipalities_select on public.municipalities
  for select using (public.is_active_user());

create policy municipalities_write on public.municipalities
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());

-- barangays ------------------------------------------------------------------
create policy barangays_select on public.barangays
  for select using (public.is_active_user());

create policy barangays_insert on public.barangays
  for insert with check (public.is_active_user());

create policy barangays_update on public.barangays
  for update using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());

create policy barangays_delete on public.barangays
  for delete using (public.has_permission('settings.manage') or public.is_management());

-- products -----------------------------------------------------------------
create policy products_select on public.products
  for select using (public.is_active_user());

create policy products_write on public.products
  for all using (public.has_permission('products.manage') or public.is_management())
  with check (public.has_permission('products.manage') or public.is_management());

-- price_history --------------------------------------------------------------
create policy price_history_select on public.price_history
  for select using (public.has_permission('products.manage') or public.is_management());

create policy price_history_write on public.price_history
  for all using (public.has_permission('products.manage') or public.is_management())
  with check (public.has_permission('products.manage') or public.is_management());

-- kpi_targets ------------------------------------------------------------
create policy kpi_targets_select on public.kpi_targets
  for select using (public.is_active_user());

create policy kpi_targets_write on public.kpi_targets
  for all using (public.has_permission('settings.manage') or public.is_management())
  with check (public.has_permission('settings.manage') or public.is_management());

-- profiles -----------------------------------------------------------------
-- No insert/delete policy for the authenticated role: profiles are created
-- exclusively by the invite server action using the service role key, and
-- are never hard-deleted (§5.9).
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.has_permission('users.manage')
    or public.is_management()
  );

create policy profiles_update on public.profiles
  for update using (
    id = auth.uid()
    or public.has_permission('users.manage')
    or public.is_management()
  )
  with check (
    id = auth.uid()
    or public.has_permission('users.manage')
    or public.is_management()
  );

-- user_invitations -------------------------------------------------------
-- Read-only from the client. All writes (create/resend/revoke) go through
-- the invite server action's service-role client (§5.6), which bypasses RLS.
create policy user_invitations_select on public.user_invitations
  for select using (public.has_permission('users.manage') or public.is_management());

-- audit_log ----------------------------------------------------------------
-- Append-only: no update or delete policy exists for any role, ever (§15.7).
create policy audit_log_select on public.audit_log
  for select using (public.has_permission('audit.read') or public.is_management());

create policy audit_log_insert on public.audit_log
  for insert with check (auth.uid() = user_id or user_id is null);
