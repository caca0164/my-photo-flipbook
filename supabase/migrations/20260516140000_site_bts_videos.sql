-- BTS page: YouTube videos managed in admin, shown on public /bts.

create table if not exists public.site_bts_videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null,
  title_en text not null default '',
  title_zh text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_bts_videos_youtube_id_len check (char_length(youtube_video_id) between 6 and 32)
);

create index if not exists site_bts_videos_sort_idx
  on public.site_bts_videos (published, sort_order asc, created_at asc);

alter table public.site_bts_videos enable row level security;

drop policy if exists "site_bts_videos_public_select" on public.site_bts_videos;
create policy "site_bts_videos_public_select"
  on public.site_bts_videos for select
  to anon, authenticated
  using (published = true);

drop policy if exists "site_bts_videos_admin_all" on public.site_bts_videos;
create policy "site_bts_videos_admin_all"
  on public.site_bts_videos for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
