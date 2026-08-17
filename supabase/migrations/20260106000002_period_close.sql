-- Phase 6 §7.10: period close pre-checks. Turns month-end into a real
-- checkpoint — closing is refused while operational loose ends remain open.
--
-- One of the four spec-listed blockers ("draft or unsynced offline sales
-- still queued on any device") cannot be checked here: the offline queue
-- lives in IndexedDB on each DSP's own device (§9.3) and the server has no
-- visibility into it — there is no table row to query. That check is
-- therefore a manual acknowledgement checkbox in the close-period UI, not
-- a server-verifiable one; see close-period-dialog.tsx.

create or replace function public.period_close_precheck(p_year int, p_month int)
returns table (check_name text, item_count int, description text)
language sql
stable
as $$
  select
    'pending_issuances'::text,
    count(*)::int,
    'Pending stock issuances not yet acknowledged'::text
  from public.stock_issuances
  where status = 'pending'
  union all
  select
    'unapproved_counts'::text,
    count(*)::int,
    'Stock counts submitted but not approved'::text
  from public.stock_counts
  where status = 'submitted'
  union all
  select
    'unresolved_empties_variance'::text,
    count(*)::int,
    'Sales this month with unresolved empties variance beyond threshold'::text
  from public.sales
  where deleted_at is null
    and extract(year from sale_date)::int = p_year
    and extract(month from sale_date)::int = p_month
    and empties_variance > coalesce(public.setting_number('empties_balance_notification_threshold'), 20);
$$;

comment on function public.period_close_precheck(int, int) is
  'Read-only pre-check for the Settings -> Periods close dialog (§7.10). Always returns 3 rows; item_count = 0 means clear.';

create or replace function public.close_accounting_period(p_year int, p_month int)
returns void
language plpgsql
security invoker
as $$
declare
  v_blockers int;
begin
  select coalesce(sum(item_count), 0) into v_blockers
  from public.period_close_precheck(p_year, p_month);

  if v_blockers > 0 then
    raise exception 'Cannot close period: % outstanding item(s) remain. Re-check before retrying.', v_blockers;
  end if;

  insert into public.accounting_periods (year, month, status, closed_by, closed_at)
  values (p_year, p_month, 'closed', auth.uid(), now())
  on conflict (year, month) do update
    set status = 'closed',
        closed_by = auth.uid(),
        closed_at = now(),
        reopened_by = null,
        reopened_at = null,
        reopen_reason = null;
end;
$$;

comment on function public.close_accounting_period(int, int) is
  'Closes a month after re-verifying the pre-checks server-side (§7.10). RLS on accounting_periods (settings.manage or management) still applies since this runs SECURITY INVOKER.';

create or replace function public.reopen_accounting_period(p_year int, p_month int, p_reason text)
returns void
language plpgsql
security invoker
as $$
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reopen a closed period.';
  end if;

  update public.accounting_periods
  set status = 'open', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = p_reason
  where year = p_year and month = p_month and status = 'closed';

  if not found then
    raise exception 'No closed period found for %-%.', p_year, p_month;
  end if;
end;
$$;

comment on function public.reopen_accounting_period(int, int, text) is
  'Reopens a closed period with a required reason (§7.10). RLS on accounting_periods still applies.';
