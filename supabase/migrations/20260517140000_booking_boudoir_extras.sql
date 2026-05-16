-- Boudoir: female assistant choice (no makeup) + admin-editable confidentiality statement.

alter table public.booking_config
  add column if not exists boudoir_confidentiality_md_en text not null default '',
  add column if not exists boudoir_confidentiality_md_zh text not null default '';

alter table public.booking_orders
  add column if not exists female_assistant text
    check (female_assistant is null or female_assistant in ('yes', 'no'));
