-- Paid booking: optional post-paid chat seed flag + structured intake prompts in chat.

alter table public.booking_orders
  add column if not exists post_paid_chat_seed_at timestamptz;

alter table public.booking_chat_messages
  drop constraint if exists booking_chat_messages_body_check;

alter table public.booking_chat_messages
  add column if not exists kind text not null default 'text'
    check (kind in ('text', 'intake_prompt'));

alter table public.booking_chat_messages
  add column if not exists payload jsonb;

alter table public.booking_chat_messages
  add constraint booking_chat_messages_body_kind_check check (
    (kind = 'text' and char_length(trim(body)) > 0)
    or (
      kind = 'intake_prompt'
      and payload is not null
      and (payload ? 'ruleId')
      and (payload ? 'options')
    )
  );

comment on column public.booking_chat_messages.kind is 'text = plain message; intake_prompt = checkbox survey (see payload).';
comment on column public.booking_chat_messages.payload is 'For intake_prompt: { ruleId, questionEn, questionZh, options: [{id,labelEn,labelZh}] }.';

-- Configurable questions (admin). Filters: NULL or empty array = match any.

create table if not exists public.booking_intake_rules (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  enabled boolean not null default true,
  match_shoot_types text[] null,
  match_party_sizes text[] null,
  match_hours_tiers text[] null,
  match_makeup text[] null,
  match_female_assistants text[] null,
  match_slot_weekdays int[] null,
  question_en text not null,
  question_zh text not null,
  options jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_intake_rules_options_len check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) >= 2
    and jsonb_array_length(options) <= 4
  )
);

create index if not exists booking_intake_rules_sort_idx
  on public.booking_intake_rules (enabled desc, sort_order asc, id asc);

alter table public.booking_intake_rules enable row level security;

drop policy if exists "booking_intake_rules_admin_all" on public.booking_intake_rules;
create policy "booking_intake_rules_admin_all"
  on public.booking_intake_rules for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create table if not exists public.booking_intake_responses (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null references public.booking_orders (id) on delete cascade,
  rule_id uuid not null references public.booking_intake_rules (id) on delete cascade,
  prompt_message_id uuid references public.booking_chat_messages (id) on delete set null,
  selected_option_ids text[] not null,
  created_at timestamptz not null default now(),
  unique (booking_order_id, rule_id)
);

create index if not exists booking_intake_responses_booking_idx
  on public.booking_intake_responses (booking_order_id);

alter table public.booking_intake_responses enable row level security;

drop policy if exists "booking_intake_responses_admin_all" on public.booking_intake_responses;
create policy "booking_intake_responses_admin_all"
  on public.booking_intake_responses for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "booking_intake_responses_member_select" on public.booking_intake_responses;
create policy "booking_intake_responses_member_select"
  on public.booking_intake_responses for select
  to authenticated
  using (public.member_owns_booking(booking_order_id));
