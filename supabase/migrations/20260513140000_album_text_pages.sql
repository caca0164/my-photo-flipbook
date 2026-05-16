-- Add text / blank pages and nullable image path. Run after initial flipbook migration.

alter table public.album_images drop constraint if exists album_images_storage_path_key;

alter table public.album_images alter column storage_path drop not null;

create unique index if not exists album_images_storage_path_unique
  on public.album_images (storage_path)
  where storage_path is not null;

alter table public.album_images add column if not exists page_kind text not null default 'image';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'album_images' and c.conname = 'album_images_page_kind_check'
  ) then
    alter table public.album_images add constraint album_images_page_kind_check
      check (page_kind in ('image', 'text'));
  end if;
end $$;

alter table public.album_images add column if not exists body_text text not null default '';

alter table public.album_images drop constraint if exists album_images_page_shape_check;

alter table public.album_images add constraint album_images_page_shape_check check (
  (page_kind = 'image' and storage_path is not null)
  or (page_kind = 'text' and storage_path is null)
);

update public.album_images set page_kind = 'image' where coalesce(page_kind, '') = '';
