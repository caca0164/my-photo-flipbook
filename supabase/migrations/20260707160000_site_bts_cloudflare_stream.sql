-- BTS: optional Cloudflare Stream uploads alongside YouTube.

alter table public.site_bts_videos
  add column if not exists video_source text not null default 'youtube',
  add column if not exists cloudflare_stream_uid text;

alter table public.site_bts_videos
  alter column youtube_video_id drop not null;

alter table public.site_bts_videos
  drop constraint if exists site_bts_videos_youtube_id_len;

alter table public.site_bts_videos
  drop constraint if exists site_bts_videos_source_check;

alter table public.site_bts_videos
  add constraint site_bts_videos_source_check
  check (video_source in ('youtube', 'cloudflare'));

alter table public.site_bts_videos
  drop constraint if exists site_bts_videos_source_payload_check;

alter table public.site_bts_videos
  add constraint site_bts_videos_source_payload_check
  check (
    (
      video_source = 'youtube'
      and youtube_video_id is not null
      and char_length(youtube_video_id) between 6 and 32
      and cloudflare_stream_uid is null
    )
    or (
      video_source = 'cloudflare'
      and cloudflare_stream_uid is not null
      and char_length(cloudflare_stream_uid) between 8 and 64
    )
  );
