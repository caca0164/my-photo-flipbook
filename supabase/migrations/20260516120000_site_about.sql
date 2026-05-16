-- Public About page: extra body copy per locale (fixed lead line lives in i18n).

create table if not exists public.site_about (
  id text primary key default 'default',
  content_en text not null default '',
  content_zh text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_about (id, content_en, content_zh)
values ('default', '', '')
on conflict (id) do nothing;

alter table public.site_about enable row level security;

drop policy if exists "site_about_public_select" on public.site_about;
create policy "site_about_public_select"
  on public.site_about for select
  to anon, authenticated
  using (true);

drop policy if exists "site_about_admin_all" on public.site_about;
create policy "site_about_admin_all"
  on public.site_about for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
