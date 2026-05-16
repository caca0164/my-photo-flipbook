-- Allow admins to update booking rows (e.g. reschedule slot_start / slot_end).

drop policy if exists "booking_orders_admin_update" on public.booking_orders;
create policy "booking_orders_admin_update"
  on public.booking_orders for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
