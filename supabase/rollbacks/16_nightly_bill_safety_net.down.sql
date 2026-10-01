-- Rollback for migrations/16_nightly_bill_safety_net.sql
-- Restores the earlier job, which created the month's bills only on the 1st.

create or replace function public.process_daily_payments()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_ist_date date := timezone('Asia/Kolkata', now())::date;
  current_month_str text := to_char(current_ist_date, 'YYYY-MM');
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and current_ist_date > due_date;

  if extract(day from current_ist_date) = 1 then
    insert into public.payments (
      id, tenant_id, tenant_name, room_number, amount, month, due_date,
      status, hostel_id, receipt_note, source, is_remainder
    )
    select
      'pay-cron-' || t.id || '-' || current_month_str,
      t.id,
      t.name,
      t.room_number,
      t.rent_amount,
      current_month_str,
      (current_month_str || '-10')::date,
      'pending',
      t.hostel_id,
      'Automated monthly rent for ' || current_month_str,
      'cron',
      false
    from public.tenants t
    where t.is_active
      and not exists (
        select 1
        from public.payments p
        where p.tenant_id = t.id
          and p.month = current_month_str
          and not p.is_remainder
      );
  end if;
end
$$;
