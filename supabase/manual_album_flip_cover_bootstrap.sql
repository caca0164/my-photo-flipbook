-- ---------------------------------------------------------------------------
-- Manual bootstrap: public.album_flip_cover
-- Use when you see: "Could not find the table 'public.album_flip_cover' in the schema cache"
-- Run in Supabase → SQL → New query (requires public.profiles for admin RLS policies).
-- ---------------------------------------------------------------------------

create table if not exists public.album_flip_cover (
  id smallint primary key check (id = 1),
  cover_enabled boolean not null default true,
  title_text text not null default 'Drew Poon',
  font_preset text not null default 'zhi_mang_xing',
  font_size_px int not null default 48,
  title_opacity real not null default 1,
  title_gold_preset text not null default 'gold_01',
  side_nav_title_text text not null default '',
  side_nav_font_preset text not null default 'zhi_mang_xing',
  side_nav_font_size_px int not null default 22,
  side_nav_title_opacity real not null default 1,
  side_nav_title_gold_preset text not null default 'gold_01',
  side_nav_title_align text not null default 'left',
  updated_at timestamptz default now()
);

-- Align with app + later migrations if table already existed from an older partial migration
alter table public.album_flip_cover
  drop constraint if exists album_flip_cover_cover_display_mode_check;

alter table public.album_flip_cover
  drop column if exists cover_display_mode;

alter table public.album_flip_cover
  add column if not exists side_nav_title_text text not null default '';

alter table public.album_flip_cover
  add column if not exists side_nav_font_preset text not null default 'zhi_mang_xing';

alter table public.album_flip_cover
  add column if not exists side_nav_font_size_px int not null default 22;

alter table public.album_flip_cover
  add column if not exists side_nav_title_opacity real not null default 1;

alter table public.album_flip_cover
  add column if not exists side_nav_title_gold_preset text not null default 'gold_01';

alter table public.album_flip_cover
  add column if not exists side_nav_title_align text not null default 'left';

alter table public.album_flip_cover
  add column if not exists title_opacity real;

alter table public.album_flip_cover
  add column if not exists title_gold_preset text;

update public.album_flip_cover
set
  title_opacity = coalesce(title_opacity, 1),
  title_gold_preset = coalesce(nullif(trim(title_gold_preset), ''), 'gold_01')
where id = 1;

alter table public.album_flip_cover
  alter column title_opacity set default 1,
  alter column title_opacity set not null;

alter table public.album_flip_cover
  alter column title_gold_preset set default 'gold_01',
  alter column title_gold_preset set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'album_flip_cover_font_size_px_check'
      and conrelid = 'public.album_flip_cover'::regclass
  ) then
    alter table public.album_flip_cover drop constraint album_flip_cover_font_size_px_check;
  end if;
end $$;

alter table public.album_flip_cover
  add constraint album_flip_cover_font_size_px_check
  check (font_size_px >= 24 and font_size_px <= 120);

alter table public.album_flip_cover
  alter column font_size_px set default 48;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'album_flip_cover_title_opacity_check'
      and conrelid = 'public.album_flip_cover'::regclass
  ) then
    alter table public.album_flip_cover drop constraint album_flip_cover_title_opacity_check;
  end if;
end $$;

alter table public.album_flip_cover
  add constraint album_flip_cover_title_opacity_check
  check (title_opacity >= 0 and title_opacity <= 1);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'album_flip_cover_side_nav_font_size_px_check'
      and conrelid = 'public.album_flip_cover'::regclass
  ) then
    alter table public.album_flip_cover drop constraint album_flip_cover_side_nav_font_size_px_check;
  end if;
end $$;

alter table public.album_flip_cover
  add constraint album_flip_cover_side_nav_font_size_px_check
  check (side_nav_font_size_px >= 14 and side_nav_font_size_px <= 120);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'album_flip_cover_side_nav_title_opacity_check'
      and conrelid = 'public.album_flip_cover'::regclass
  ) then
    alter table public.album_flip_cover drop constraint album_flip_cover_side_nav_title_opacity_check;
  end if;
end $$;

alter table public.album_flip_cover
  add constraint album_flip_cover_side_nav_title_opacity_check
  check (side_nav_title_opacity >= 0 and side_nav_title_opacity <= 1);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'album_flip_cover_side_nav_title_align_check'
      and conrelid = 'public.album_flip_cover'::regclass
  ) then
    alter table public.album_flip_cover drop constraint album_flip_cover_side_nav_title_align_check;
  end if;
end $$;

update public.album_flip_cover
set side_nav_title_align = 'left'
where side_nav_title_align is null
   or side_nav_title_align not in ('left', 'center', 'right');

alter table public.album_flip_cover
  add constraint album_flip_cover_side_nav_title_align_check
  check (side_nav_title_align in ('left', 'center', 'right'));

insert into public.album_flip_cover (id)
values (1)
on conflict (id) do nothing;

alter table public.album_flip_cover enable row level security;

drop policy if exists "album_flip_cover_public_read" on public.album_flip_cover;
drop policy if exists "album_flip_cover_admin_update" on public.album_flip_cover;
drop policy if exists "album_flip_cover_admin_insert" on public.album_flip_cover;

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

-- Ask PostgREST to reload schema (fixes stale "schema cache" after DDL)
notify pgrst, 'reload schema';
