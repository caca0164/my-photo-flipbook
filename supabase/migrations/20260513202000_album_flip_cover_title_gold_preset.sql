-- Preset id for cover title gold gradient (app-defined list, e.g. gold_01 … gold_30).

alter table public.album_flip_cover
  add column if not exists title_gold_preset text not null default 'gold_01';
