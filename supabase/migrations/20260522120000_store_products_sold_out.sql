alter table public.store_products
  add column if not exists sold_out boolean not null default false;
