-- Widen font_size_px range: now stores signature image max-width (px), not text size.

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
  check (font_size_px >= 120 and font_size_px <= 480);

update public.album_flip_cover
set font_size_px = case
  when font_size_px < 120 then least(420, greatest(120, round(font_size_px::numeric * 5)))
  else least(420, greatest(120, font_size_px))
end
where id = 1;

alter table public.album_flip_cover
  alter column font_size_px set default 280;
