-- Atomic sale creation (§9, §7.9). SECURITY INVOKER — every insert inside
-- still runs under the caller's own role, so the sales/sale_items RLS
-- policies (permission + dsp_id scoping) apply exactly as if the client had
-- called insert directly. This function exists purely for transactional
-- atomicity (header + items together) and idempotency, not to bypass RLS.
create or replace function public.create_sale(
  p_client_ref uuid,
  p_customer_id uuid,
  p_sale_date date,
  p_deployment_date date,
  p_payment_status text,
  p_amount_paid numeric,
  p_empties_collected integer,
  p_crates_returned_by_customer integer,
  p_notes text,
  -- array of {product_id, qty_crates, qty_canisters, qty_sets, notes}
  p_items jsonb
)
returns table (sale_id uuid, was_duplicate boolean)
language plpgsql
security invoker
as $$
declare
  v_existing_id uuid;
  v_customer public.customers%rowtype;
  v_new_sale_id uuid;
  v_item jsonb;
begin
  -- Idempotency (§7.9 #3): a retry with the same client_ref returns the
  -- original sale and reports success — never a second row.
  select id into v_existing_id from public.sales where client_ref = p_client_ref;
  if v_existing_id is not null then
    return query select v_existing_id, true;
    return;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one line item.';
  end if;

  select * into v_customer from public.customers where id = p_customer_id and deleted_at is null;
  if not found then
    raise exception 'Customer not found.';
  end if;

  -- customer_type / municipality_id / dsp_id are snapshotted from the
  -- customer row, never accepted from the client (§4.1 #4, #5).
  insert into public.sales (
    sale_date, deployment_date, customer_id, customer_type, municipality_id, dsp_id,
    payment_status, amount_paid, empties_collected, crates_returned_by_customer,
    client_ref, notes, created_by
  ) values (
    p_sale_date, p_deployment_date, v_customer.id, v_customer.customer_type,
    v_customer.municipality_id, v_customer.dsp_id,
    p_payment_status, p_amount_paid, p_empties_collected, p_crates_returned_by_customer,
    p_client_ref, p_notes, auth.uid()
  ) returning id into v_new_sale_id;

  -- unit_price is always the product's current price, fetched here — never
  -- accepted from the client (§4.1 #4).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items (sale_id, product_id, qty_crates, qty_canisters, qty_sets, unit_price, notes)
    select
      v_new_sale_id,
      p.id,
      coalesce((v_item->>'qty_crates')::int, 0),
      coalesce((v_item->>'qty_canisters')::int, 0),
      coalesce((v_item->>'qty_sets')::int, 0),
      p.unit_price,
      nullif(v_item->>'notes', '')
    from public.products p
    where p.id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'Unknown product_id %', v_item->>'product_id';
    end if;
  end loop;

  return query select v_new_sale_id, false;
end;
$$;

-- Near-duplicate soft warning (§7.9 #5): same customer + same total within
-- the last N minutes. Non-blocking — the UI decides what to do with it.
create or replace function public.find_recent_similar_sales(
  p_customer_id uuid,
  p_total_amount numeric,
  p_minutes integer default 10
)
returns table (id uuid, receipt_no text, created_at timestamptz)
language sql
stable
as $$
  select id, receipt_no, created_at
  from public.sales
  where customer_id = p_customer_id
    and deleted_at is null
    and total_amount = p_total_amount
    and created_at > now() - (p_minutes || ' minutes')::interval
  order by created_at desc;
$$;
