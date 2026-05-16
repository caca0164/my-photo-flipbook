-- One-shot: same DDL as migrations/20260514160000_store_commerce.sql (run in Supabase SQL Editor).

-- Store: products, orders, line items. Stripe checkout + webhook update paid status.
-- Guest checkout inserts use service role from Next.js server actions (bypass RLS).

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  product_kind text not null check (product_kind in ('physical_album', 'e_album', 'framed_print')),
  title_en text not null,
  title_zh text not null,
  description_en text not null default '',
  description_zh text not null default '',
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'hkd' check (currency = lower(currency)),
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists store_products_active_sort_idx
  on public.store_products (active, sort_order);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  customer_phone text not null default '',
  shipping_address text not null default '',
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'processing', 'shipped', 'cancelled')),
  currency text not null default 'hkd',
  total_cents int not null check (total_cents >= 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  locale text not null default 'en' check (locale in ('en', 'zh')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists store_orders_user_idx on public.store_orders (user_id);
create index if not exists store_orders_status_idx on public.store_orders (status);
create index if not exists store_orders_stripe_session_idx on public.store_orders (stripe_checkout_session_id);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  product_id uuid not null references public.store_products (id),
  quantity int not null check (quantity >= 1 and quantity <= 99),
  unit_price_cents int not null check (unit_price_cents >= 0),
  title_en_snapshot text not null,
  title_zh_snapshot text not null
);

create index if not exists store_order_items_order_idx on public.store_order_items (order_id);

alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

drop policy if exists "store_products_public_read" on public.store_products;
create policy "store_products_public_read"
  on public.store_products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "store_products_admin_all" on public.store_products;
create policy "store_products_admin_all"
  on public.store_products for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "store_orders_admin_all" on public.store_orders;
create policy "store_orders_admin_all"
  on public.store_orders for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "store_orders_user_select" on public.store_orders;
create policy "store_orders_user_select"
  on public.store_orders for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "store_orders_user_insert" on public.store_orders;
create policy "store_orders_user_insert"
  on public.store_orders for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "store_order_items_admin_all" on public.store_order_items;
create policy "store_order_items_admin_all"
  on public.store_order_items for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "store_order_items_user_select" on public.store_order_items;
create policy "store_order_items_user_select"
  on public.store_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.store_orders o
      where o.id = store_order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "store_order_items_user_insert" on public.store_order_items;
create policy "store_order_items_user_insert"
  on public.store_order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.store_orders o
      where o.id = store_order_items.order_id and o.user_id = auth.uid()
    )
  );

-- Seed catalog (HKD). Edit prices/images in admin after deploy.
insert into public.store_products (slug, product_kind, title_en, title_zh, description_en, description_zh, price_cents, currency, sort_order, active)
values
  (
    'physical-photo-album',
    'physical_album',
    'Physical photo album',
    '實體相集',
    'Premium printed album with lay-flat binding. Ships worldwide.',
    '高級實體相冊，可攤平裝訂。可寄送。',
    88000,
    'hkd',
    1,
    true
  ),
  (
    'e-album-digital',
    'e_album',
    'E-ALBUM (digital)',
    'E-ALBUM 電子相冊',
    'High-resolution digital flipbook package with download link.',
    '高解析度電子翻頁相冊套裝，含下載連結。',
    32000,
    'hkd',
    2,
    true
  ),
  (
    'large-framed-print',
    'framed_print',
    'Large framed wall print',
    '連框大型相',
    'Museum-grade print with archival frame. Custom sizing on request.',
    '博物館級輸出與典藏框。尺寸可另議。',
    268000,
    'hkd',
    3,
    true
  )
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
