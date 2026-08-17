-- Phase 6 §6.1: price_history is a ledger of price changes, not a manually
-- maintained table — every unit_price change on products writes a row here
-- automatically, closing out the previous one, so historical sale_items
-- (which snapshot unit_price at sale time) can always be explained by what
-- the price actually was on that date.

create or replace function public.products_track_price_change()
returns trigger
language plpgsql
as $$
begin
  if new.unit_price is distinct from old.unit_price then
    update public.price_history
    set effective_to = now()
    where product_id = new.id and effective_to is null;

    insert into public.price_history (product_id, unit_price, effective_from, changed_by)
    values (new.id, new.unit_price, now(), auth.uid());
  end if;
  return new;
end;
$$;

create trigger products_track_price_change
  after update of unit_price on public.products
  for each row execute function public.products_track_price_change();

create or replace function public.products_seed_price_history()
returns trigger
language plpgsql
as $$
begin
  insert into public.price_history (product_id, unit_price, effective_from, changed_by)
  values (new.id, new.unit_price, new.created_at, auth.uid());
  return new;
end;
$$;

create trigger products_seed_price_history
  after insert on public.products
  for each row execute function public.products_seed_price_history();
