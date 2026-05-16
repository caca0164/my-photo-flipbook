-- Cover is text + Google Font only. Map legacy signature max-width (px) to font size; drop image mode column.

update public.album_flip_cover
set font_size_px = least(120, greatest(24, round(font_size_px::numeric / 5)::int))
where id = 1 and font_size_px > 120;

alter table public.album_flip_cover
  drop constraint if exists album_flip_cover_cover_display_mode_check;

alter table public.album_flip_cover
  drop column if exists cover_display_mode;

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
