-- Booking wizard: configurable prices, notices, Google Calendar id + optional SA JSON (server-only).
-- Orders mirror store pattern for Stripe checkout + webhook.

create table if not exists public.booking_config (
  id text primary key default 'default',
  currency text not null default 'hkd' check (currency = lower(currency)),
  price_shoot_portrait_cents int not null default 0 check (price_shoot_portrait_cents >= 0),
  price_shoot_boudoir_cents int not null default 0 check (price_shoot_boudoir_cents >= 0),
  price_shoot_prewedding_cents int not null default 0 check (price_shoot_prewedding_cents >= 0),
  price_party_single_cents int not null default 0 check (price_party_single_cents >= 0),
  price_party_double_cents int not null default 0 check (price_party_double_cents >= 0),
  price_party_group_cents int not null default 0 check (price_party_group_cents >= 0),
  price_hours_2_cents int not null default 0 check (price_hours_2_cents >= 0),
  price_hours_3_cents int not null default 0 check (price_hours_3_cents >= 0),
  price_hours_10_cents int not null default 0 check (price_hours_10_cents >= 0),
  price_makeup_yes_cents int not null default 0 check (price_makeup_yes_cents >= 0),
  price_makeup_no_cents int not null default 0 check (price_makeup_no_cents >= 0),
  notices_md_en text not null default '',
  notices_md_zh text not null default '',
  google_calendar_id text not null default '',
  google_sa_json text,
  updated_at timestamptz default now()
);

insert into public.booking_config (id)
values ('default')
on conflict (id) do nothing;

alter table public.booking_config enable row level security;

drop policy if exists "booking_config_no_public" on public.booking_config;
create policy "booking_config_no_public"
  on public.booking_config for select
  to anon
  using (false);

drop policy if exists "booking_config_admin_all" on public.booking_config;
create policy "booking_config_admin_all"
  on public.booking_config for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create table if not exists public.booking_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  customer_phone text not null default '',
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled')),
  currency text not null default 'hkd',
  total_cents int not null check (total_cents >= 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  locale text not null default 'en' check (locale in ('en', 'zh')),
  shoot_type text not null check (shoot_type in ('portrait', 'boudoir', 'prewedding')),
  party_size text not null check (party_size in ('single', 'double', 'group')),
  hours_tier text not null check (hours_tier in ('h2', 'h3', 'h10')),
  makeup text not null check (makeup in ('yes', 'no')),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists booking_orders_status_idx on public.booking_orders (status);
create index if not exists booking_orders_stripe_session_idx on public.booking_orders (stripe_checkout_session_id);

alter table public.booking_orders enable row level security;

drop policy if exists "booking_orders_no_public" on public.booking_orders;
create policy "booking_orders_no_public"
  on public.booking_orders for select
  to anon
  using (false);

drop policy if exists "booking_orders_admin_read" on public.booking_orders;
create policy "booking_orders_admin_read"
  on public.booking_orders for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
