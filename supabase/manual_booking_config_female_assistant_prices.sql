-- ============================================================
-- 手動套用：booking_config 女助手加價欄位
-- 在 Supabase Dashboard → SQL Editor 貼上執行（與 migration 20260517150000 相同）
--
-- 若報錯「relation booking_config does not exist」，請先執行：
--   migrations/20260515120000_booking_wizard.sql
-- ============================================================

-- 若表存在才加欄（避免誤判已存在表）
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'booking_config'
  ) then
    alter table public.booking_config
      add column if not exists price_female_assistant_yes_cents int not null default 0
        check (price_female_assistant_yes_cents >= 0),
      add column if not exists price_female_assistant_no_cents int not null default 0
        check (price_female_assistant_no_cents >= 0);
  else
    raise exception 'public.booking_config 不存在，請先執行 20260515120000_booking_wizard.sql';
  end if;
end $$;

-- 驗證（應各出現一列）
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'booking_config'
  and column_name in ('price_female_assistant_yes_cents', 'price_female_assistant_no_cents')
order by column_name;
