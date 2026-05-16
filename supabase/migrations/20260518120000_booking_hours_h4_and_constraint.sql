-- 預約：4 小時加價欄位 + hours_tier 允許 h4（Full Day / h10 僅為 pre-wedding；由 App 過濾選項）。

alter table public.booking_config
  add column if not exists price_hours_4_cents int not null default 0 check (price_hours_4_cents >= 0);

alter table public.booking_orders drop constraint if exists booking_orders_hours_tier_check;

alter table public.booking_orders
  add constraint booking_orders_hours_tier_check check (hours_tier in ('h2', 'h3', 'h4', 'h10'));
