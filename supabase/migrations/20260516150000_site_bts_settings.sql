-- BTS page visibility: when page_hidden, public nav and /bts are admin-only.

create table if not exists public.site_bts_settings (
  id text primary key default 'default',
  page_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.site_bts_settings (id, page_hidden)
values ('default', false)
on conflict (id) do nothing;

alter table public.site_bts_settings enable row level security;

drop policy if exists "site_bts_settings_public_select" on public.site_bts_settings;
create policy "site_bts_settings_public_select"
  on public.site_bts_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "site_bts_settings_admin_all" on public.site_bts_settings;
create policy "site_bts_settings_admin_all"
  on public.site_bts_settings for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
