-- 17: Extra charges on the same month (electricity, fines, and so on).
--
-- The owner adds them with the existing "Record Payment" box: pick the tenant,
-- type the amount, keep the month, and write the reason in the Note. Until now
-- a second entry for the same month was refused, because the database allowed
-- only one bill per tenant per month.
--
-- Each bill now carries a kind:
--   'rent'  - the monthly rent bill (one per tenant per month, as before);
--   'extra' - an additional charge for that month.
-- The kind is decided by the database itself, so the app cannot get it wrong:
-- the first live bill of a month is rent, anything after it is an extra charge.
--
-- Two rules keep rent safe:
--   * the "one bill per tenant per month" rule now applies to rent only;
--   * the nightly job looks only at rent bills when deciding whether this
--     month's rent has been billed, so an extra charge never hides a missing
--     rent bill.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/17_extra_charges.down.sql

-- 1. What kind of bill each row is.
alter table public.payments add column if not exists kind text not null default 'rent';
alter table public.payments drop constraint if exists payments_kind_valid;
alter table public.payments add constraint payments_kind_valid check (kind in ('rent', 'extra'));

-- 2. The database decides the kind, not the app.
create or replace function public.set_payment_kind()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_remainder then
    return new;  -- the leftover of a part payment; excluded from both rules below
  end if;

  if exists (
    select 1 from public.payments p
    where p.tenant_id = new.tenant_id
      and p.month = new.month
      and not p.is_remainder
      and p.kind = 'rent'
      and p.status <> 'cancelled'
      and p.id is distinct from new.id
  ) then
    new.kind := 'extra';
  else
    new.kind := 'rent';
  end if;

  return new;
end
$$;

drop trigger if exists trigger_set_payment_kind on public.payments;
create trigger trigger_set_payment_kind
before insert on public.payments
for each row execute function public.set_payment_kind();

-- 3. One RENT bill per tenant per month; extra charges are unlimited.
drop index if exists public.payments_original_monthly_bill_unique;
create unique index if not exists payments_original_monthly_bill_unique
  on public.payments (tenant_id, month)
  where (not is_remainder and status <> 'cancelled' and kind = 'rent');

-- 4. The nightly job counts rent bills only.
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
            and p.kind = 'rent'
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
