-- Numeric settings accessor used by SQL triggers that must mirror
-- src/lib/volume/calculations.ts's formula (§7.1) without a live DB
-- connection to TypeScript. Keep this arithmetic in lockstep with that file.
create or replace function public.setting_number(setting_key text)
returns numeric
language sql
stable
as $$
  select value::numeric from public.settings where key = setting_key;
$$;
