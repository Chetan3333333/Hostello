-- 16: The nightly job no longer loses a whole month if the 1st is missed (fix #10).
--
-- Before: the month's rent bills were created only when the job ran on the 1st.
-- If that single run failed (it did on 1 June 2026), the month was never billed
-- and nobody was told.
--
-- After: every night the job creates any rent bill that is missing for the
-- current month. Repeating it is harmless: each bill has a fixed id built from
-- the tenant and the month, and tenants who already have a bill for the month
-- are skipped, whatever its status (including cancelled).
--
-- Deliberately unchanged:
--   * rent rules: every active tenant, full month, due on the 10th;
--   * the overdue marking;
--   * only the CURRENT month is ever created - the job never goes back and
--     creates bills for a closed month.
-- New: when bills are created on any day other than the 1st, a warning line is
-- written to the activity history so a missed night is visible.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/16_nightly_bill_safety_net.down.sql

create or replace function public.process_daily_payments()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_ist_date date := timezone('Asia/Kolkata', now())::date;
  current_month_str text := to_char(current_ist_date, 'YYYY-MM');
  is_first_of_month boolean := extract(day from current_ist_date) = 1;
  rec record;
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and current_ist_date > due_date;

  for rec in
    with new_bills as (
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
        )
      returning hostel_id
    )
    select hostel_id, count(*) as created
    from new_bills
    group by hostel_id
  loop
    if not is_first_of_month then
      perform public.write_activity_log(
        rec.hostel_id, 'system',
        'WARNING: ' || rec.created || ' rent bill(s) for ' || current_month_str ||
        ' were created late by the nightly job; the 1st-of-month run did not happen.'
      );
    end if;
  end loop;
end
$$;
