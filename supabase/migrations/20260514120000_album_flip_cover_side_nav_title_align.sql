-- Side drawer title horizontal alignment (left / center / right).

alter table public.album_flip_cover
  add column if not exists side_nav_title_align text not null default 'left';

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
