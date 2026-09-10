-- Adds Subdealer (SD) as a fourth sales channel alongside HH/RTL/WS.
-- Treated the same as RTL/WS everywhere the schema already generalizes on
-- "not HH" (customers_rtl_ws_requires_contact, sales_recompute triggers) —
-- only the two explicit allow-lists need widening. The 300-account KPI
-- (company_kpi_progress) intentionally still counts RTL+WS only; whether
-- Subdealer accounts should count toward that target is a separate call.

alter table public.customers drop constraint customers_customer_type_check;
alter table public.customers add constraint customers_customer_type_check
  check (customer_type in ('HH', 'RTL', 'WS', 'SD'));

alter table public.sales drop constraint sales_customer_type_check;
alter table public.sales add constraint sales_customer_type_check
  check (customer_type in ('HH', 'RTL', 'WS', 'SD'));
