-- Post-payment intake rules: filter by HK slot start time (HH:mm).

alter table public.booking_intake_rules
  add column if not exists match_slot_start_times text[] null;

comment on column public.booking_intake_rules.match_slot_start_times is
  'HK local shoot start times (e.g. 10:00, 14:30). NULL or empty = match any.';
