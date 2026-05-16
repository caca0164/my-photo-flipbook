-- Run in Supabase SQL Editor (or via CLI). Adjust if tables already exist.

-- Profiles linked to auth.users; role: user | admin
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Ordered album pages (paths inside bucket `flipbook`)
create table if not exists public.album_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists album_images_sort_order_idx on public.album_images (sort_order);

alter table public.album_images enable row level security;

create policy "album_images_public_read"
  on public.album_images for select
  to anon, authenticated
  using (true);

create policy "album_images_admin_insert"
  on public.album_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "album_images_admin_update"
  on public.album_images for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "album_images_admin_delete"
  on public.album_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- New auth users get profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket (public read)
insert into storage.buckets (id, name, public)
values ('flipbook', 'flipbook', true)
on conflict (id) do update set public = excluded.public;

create policy "flipbook_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'flipbook');

create policy "flipbook_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flipbook'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "flipbook_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flipbook'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "flipbook_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flipbook'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Promote your user to admin (replace with your auth.users id after signup):
-- update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';
