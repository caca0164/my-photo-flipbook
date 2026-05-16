-- Cover can show built-in PNG (image) or live text + Google Font (text).
-- font_size_px: image mode = signature max width (120–480); text mode = CSS font-size (24–120).

alter table public.album_flip_cover
  add column if not exists cover_display_mode text not null default 'image';

alter table public.album_flip_cover
  drop constraint if exists album_flip_cover_cover_display_mode_check;

alter table public.album_flip_cover
  add constraint album_flip_cover_cover_display_mode_check
  check (cover_display_mode in ('image', 'text'));

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
  check (font_size_px >= 24 and font_size_px <= 480);
