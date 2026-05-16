-- Chatroom access: paid bookings only (not pending_payment).

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
      and b.status = 'paid'
  );
$$;

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
      and b.status = 'paid'
  ) then
    return;
  end if;

  v_thread_id := public.get_or_create_booking_chat_thread(p_booking_id);

  return query
  select v_thread_id, p_booking_id;
end;
$$;

create or replace function public.get_or_create_booking_chat_thread(p_booking_id uuid)
returns uuid
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
      and b.status = 'paid'
  ) then
    return null;
  end if;

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
