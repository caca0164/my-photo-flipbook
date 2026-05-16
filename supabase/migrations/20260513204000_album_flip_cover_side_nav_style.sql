-- Independent gold / font / size / opacity for the side drawer title vs home flipbook cover.

alter table public.album_flip_cover
  add column if not exists side_nav_font_preset text not null default 'zhi_mang_xing';

alter table public.album_flip_cover
  add column if not exists side_nav_font_size_px int not null default 22;

alter table public.album_flip_cover
  add column if not exists side_nav_title_opacity real not null default 1;

alter table public.album_flip_cover
  add column if not exists side_nav_title_gold_preset text not null default 'gold_01';

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
