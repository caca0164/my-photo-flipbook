-- Member inbox + allow members to read their own booking orders (by user_id or checkout email = auth email).

create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists member_messages_user_created_idx
  on public.member_messages (user_id, created_at desc);

alter table public.member_messages enable row level security;

drop policy if exists "member_messages_user_select" on public.member_messages;
create policy "member_messages_user_select"
  on public.member_messages for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "member_messages_admin_all" on public.member_messages;
create policy "member_messages_admin_all"
  on public.member_messages for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.mark_member_message_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.member_messages
  set read_at = now()
  where id = p_id and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_member_message_read(uuid) to authenticated;

-- Members: read own bookings (linked user_id or guest checkout email matches login email).
drop policy if exists "booking_orders_user_select" on public.booking_orders;
create policy "booking_orders_user_select"
  on public.booking_orders for select
  to authenticated
  using (
    user_id = auth.uid()
    or lower(trim(customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
