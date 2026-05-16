-- Auto messages: optional delay until all intake prompts in the chat are answered.

alter table public.booking_post_paid_auto_messages
  add column if not exists after_intake_complete boolean not null default false;

comment on column public.booking_post_paid_auto_messages.after_intake_complete is
  'When true, message is sent only after every intake_prompt in the booking chat has a response.';
