-- Fuzzy duplicate-name guard (§6.2): "on create, fuzzy-match name within
-- the same municipality and warn before saving." SECURITY INVOKER (the
-- default) — runs under the caller's own RLS scope, so a DSP never sees a
-- candidate match from a customer outside their own scope.
create or replace function public.find_similar_customers(
  p_name text,
  p_municipality_id uuid,
  p_threshold real default 0.4
)
returns table (id uuid, business_name text, owner_name text, similarity real)
language sql
stable
as $$
  select
    c.id,
    c.business_name,
    c.owner_name,
    greatest(
      extensions.similarity(coalesce(c.business_name, ''), p_name),
      extensions.similarity(coalesce(c.owner_name, ''), p_name)
    ) as similarity
  from public.customers c
  where c.municipality_id = p_municipality_id
    and c.deleted_at is null
    and (
      extensions.similarity(coalesce(c.business_name, ''), p_name) > p_threshold
      or extensions.similarity(coalesce(c.owner_name, ''), p_name) > p_threshold
    )
  order by similarity desc
  limit 5;
$$;
