-- Rollback for migrations/17_extra_charges.sql
-- Returns to one bill per tenant per month and removes the kind column.
-- Runs as one block and refuses while any extra charge exists, because those
-- rows could not be stored under the old rule.

begin;

do $$
begin
  if exists (select 1 from public.payments where kind = 'extra') then
    raise exception 'Cannot roll back: % extra charge(s) exist. Cancel or remove them first.',
      (select count(*) from public.payments where kind = 'extra');
  end if;
end
$$;

drop trigger if exists trigger_set_payment_kind on public.payments;
drop function if exists public.set_payment_kind();

drop index if exists public.payments_original_monthly_bill_unique;
create unique index if not exists payments_original_monthly_bill_unique
  on public.payments (tenant_id, month)
  where (not is_remainder and status <> 'cancelled');

alter table public.payments drop constraint if exists payments_kind_valid;
alter table public.payments drop column if exists kind;

-- the nightly job as it was in migration 16
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

commit;
