-- Optional gold title shown in the side nav (above language), editable by admins.

alter table public.album_flip_cover
  add column if not exists side_nav_title_text text not null default '';
