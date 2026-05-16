-- Private booking chat: one thread per booking order; studio ↔ guest messages.

create table if not exists public.booking_chat_threads (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null unique references public.booking_orders (id) on delete cascade,
  guest_last_read_at timestamptz,
  studio_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_chat_threads_updated_idx
  on public.booking_chat_threads (updated_at desc);

create table if not exists public.booking_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.booking_chat_threads (id) on delete cascade,
  sender_role text not null check (sender_role in ('studio', 'guest')),
  body text not null check (char_length(trim(body)) > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists booking_chat_messages_thread_created_idx
  on public.booking_chat_messages (thread_id, created_at asc);

alter table public.booking_chat_threads enable row level security;
alter table public.booking_chat_messages enable row level security;

-- Helper: member may access booking (same rule as booking_orders_user_select).
create or replace function public.member_owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.booking_orders b
    where b.id = p_booking_id
      and (
        b.user_id = auth.uid()
        or lower(trim(b.customer_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
      and b.status in ('paid', 'pending_payment')
  );
$$;

grant execute on function public.member_owns_booking(uuid) to authenticated;

create or replace function public.get_or_create_booking_chat_thread(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
begin
  select id into v_thread_id
  from public.booking_chat_threads
  where booking_order_id = p_booking_id;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  insert into public.booking_chat_threads (booking_order_id)
  values (p_booking_id)
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

grant execute on function public.get_or_create_booking_chat_thread(uuid) to authenticated;

-- Guest/member open chat: verify booking id + email (no auth required).
create or replace function public.open_booking_chat_guest(
  p_booking_id uuid,
  p_email text
)
returns table (thread_id uuid, booking_order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
begin
  if not exists (
    select 1
    from public.booking_orders b
    where b.id = p_booking_id
      and lower(trim(b.customer_email)) = lower(trim(p_email))
      and b.status in ('paid', 'pending_payment')
  ) then
    return;
  end if;

  v_thread_id := public.get_or_create_booking_chat_thread(p_booking_id);

  return query
  select v_thread_id, p_booking_id;
end;
$$;

grant execute on function public.open_booking_chat_guest(uuid, text) to anon, authenticated;

drop policy if exists "booking_chat_threads_admin_all" on public.booking_chat_threads;
create policy "booking_chat_threads_admin_all"
  on public.booking_chat_threads for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "booking_chat_threads_member_select" on public.booking_chat_threads;
create policy "booking_chat_threads_member_select"
  on public.booking_chat_threads for select
  to authenticated
  using (public.member_owns_booking(booking_order_id));

drop policy if exists "booking_chat_threads_member_insert" on public.booking_chat_threads;
create policy "booking_chat_threads_member_insert"
  on public.booking_chat_threads for insert
  to authenticated
  with check (public.member_owns_booking(booking_order_id));

drop policy if exists "booking_chat_threads_member_update" on public.booking_chat_threads;
create policy "booking_chat_threads_member_update"
  on public.booking_chat_threads for update
  to authenticated
  using (public.member_owns_booking(booking_order_id))
  with check (public.member_owns_booking(booking_order_id));

drop policy if exists "booking_chat_messages_admin_all" on public.booking_chat_messages;
create policy "booking_chat_messages_admin_all"
  on public.booking_chat_messages for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "booking_chat_messages_member_select" on public.booking_chat_messages;
create policy "booking_chat_messages_member_select"
  on public.booking_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_chat_threads t
      where t.id = thread_id
        and public.member_owns_booking(t.booking_order_id)
    )
  );

drop policy if exists "booking_chat_messages_member_insert" on public.booking_chat_messages;
create policy "booking_chat_messages_member_insert"
  on public.booking_chat_messages for insert
  to authenticated
  with check (
    sender_role = 'guest'
    and exists (
      select 1
      from public.booking_chat_threads t
      where t.id = thread_id
        and public.member_owns_booking(t.booking_order_id)
    )
  );

create or replace function public.mark_booking_chat_read_member(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.booking_chat_threads t
    where t.id = p_thread_id and public.member_owns_booking(t.booking_order_id)
  ) then
    return;
  end if;
  update public.booking_chat_threads
  set guest_last_read_at = now(), updated_at = now()
  where id = p_thread_id;
end;
$$;

grant execute on function public.mark_booking_chat_read_member(uuid) to authenticated;

create or replace function public.mark_booking_chat_read_admin(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return;
  end if;
  update public.booking_chat_threads
  set studio_last_read_at = now(), updated_at = now()
  where id = p_thread_id;
end;
$$;

grant execute on function public.mark_booking_chat_read_admin(uuid) to authenticated;
