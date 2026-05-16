-- Post-paid chat: configurable studio auto messages (same match filters + sort_order as intake rules).

create table if not exists public.booking_post_paid_auto_messages (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  enabled boolean not null default true,
  match_shoot_types text[] null,
  match_party_sizes text[] null,
  match_hours_tiers text[] null,
  match_makeup text[] null,
  match_female_assistants text[] null,
  match_slot_weekdays int[] null,
  match_slot_start_times text[] null,
  message_en text not null,
  message_zh text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_post_paid_auto_messages_sort_idx
  on public.booking_post_paid_auto_messages (enabled desc, sort_order asc, id asc);

alter table public.booking_post_paid_auto_messages enable row level security;

drop policy if exists "booking_post_paid_auto_messages_admin_all" on public.booking_post_paid_auto_messages;
create policy "booking_post_paid_auto_messages_admin_all"
  on public.booking_post_paid_auto_messages for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
