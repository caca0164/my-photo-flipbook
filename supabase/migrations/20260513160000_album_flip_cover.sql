-- Singleton: home flipbook cover (gold title page before album pages).

create table if not exists public.album_flip_cover (
  id smallint primary key check (id = 1),
  cover_enabled boolean not null default true,
  title_text text not null default 'Drew Poon',
  font_preset text not null default 'zhi_mang_xing',
  font_size_px int not null default 52
    check (font_size_px >= 20 and font_size_px <= 200),
  updated_at timestamptz default now()
);

insert into public.album_flip_cover (id)
values (1)
on conflict (id) do nothing;

alter table public.album_flip_cover enable row level security;

create policy "album_flip_cover_public_read"
  on public.album_flip_cover for select
  to anon, authenticated
  using (true);

create policy "album_flip_cover_admin_update"
  on public.album_flip_cover for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "album_flip_cover_admin_insert"
  on public.album_flip_cover for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
