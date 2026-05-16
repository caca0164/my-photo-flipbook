-- Allow the booking wizard to load prices/notices without the service role key.
-- Exposes no google_sa_json; adds a boolean flag so the app can know if a DB-stored SA exists.

create or replace function public.booking_wizard_public_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select (to_jsonb(c) - 'google_sa_json'::text)
    || jsonb_build_object(
      '_calendar_secret_in_db',
      trim(coalesce(c.google_sa_json, '')) <> ''
    )
  from public.booking_config c
  where c.id = 'default'
  limit 1;
$$;

revoke all on function public.booking_wizard_public_snapshot() from public;
grant execute on function public.booking_wizard_public_snapshot() to anon, authenticated, service_role;
