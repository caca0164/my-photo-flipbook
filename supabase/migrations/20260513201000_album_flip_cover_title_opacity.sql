-- Cover title opacity (0 = invisible, 1 = fully opaque). Used with gold gradient text on home flipbook.

alter table public.album_flip_cover
  add column if not exists title_opacity real not null default 1;

alter table public.album_flip_cover
  drop constraint if exists album_flip_cover_title_opacity_check;

alter table public.album_flip_cover
  add constraint album_flip_cover_title_opacity_check
  check (title_opacity >= 0 and title_opacity <= 1);
