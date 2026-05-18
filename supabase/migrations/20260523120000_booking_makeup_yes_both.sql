-- Double-party booking: makeup for both people (extra lead time + admin price).

alter table public.booking_config
  add column if not exists price_makeup_yes_both_cents int not null default 0
  check (price_makeup_yes_both_cents >= 0);

alter table public.booking_orders drop constraint if exists booking_orders_makeup_check;

alter table public.booking_orders
  add constraint booking_orders_makeup_check check (makeup in ('yes', 'no', 'yes_both'));
