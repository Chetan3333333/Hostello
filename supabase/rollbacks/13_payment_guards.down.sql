-- Rollback for migrations/13_payment_guards.sql
-- Puts the database back to how it was after migration 12.
-- Stops with a clear message if any bill is already cancelled, because those
-- rows would no longer be allowed.
--
-- Everything runs as one block: if the check below stops it, nothing is undone.

begin;

do $$
begin
  if exists (select 1 from public.payments where status = 'cancelled') then
    raise exception 'Cannot roll back: % bill(s) have the status cancelled. Restore or delete them first.',
      (select count(*) from public.payments where status = 'cancelled');
  end if;
end
$$;

drop trigger if exists trigger_payment_guards on public.payments;
drop function if exists public.guard_payment_changes();

alter table public.payments drop constraint if exists payments_valid_values;
alter table public.payments add constraint payments_valid_values check (
  amount > 0
  and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  and to_char(due_date, 'YYYY-MM') = month
  and status in ('paid', 'pending', 'overdue', 'written_off')
  and source in ('manual', 'check_in', 'cron', 'split')
);

-- The activity-history rules as they were in migration 09.
create or replace function public.log_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.source = 'cron' then
      perform public.write_activity_log(
        new.hostel_id, 'system',
        'System generated rent bill of ₹' || new.amount || ' for ' || new.tenant_name || ' (' || new.month || ')'
      );
    elsif new.source = 'check_in' then
      perform public.write_activity_log(
        new.hostel_id, 'system',
        'Initial rent bill of ₹' || new.amount || ' created for ' || new.tenant_name || ' (' || new.month || ')'
      );
    elsif new.source = 'split' then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'Invoice split: New pending bill of ₹' || new.amount || ' created for ' || new.tenant_name
      );
    else
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: A manual payment record of ₹' || new.amount || ' was created for ' || new.tenant_name || '.'
      );
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from 'written_off' and new.status = 'written_off' then
      perform public.write_activity_log(new.hostel_id, 'payment', '₹' || new.amount || ' written off for ' || new.tenant_name);
    end if;
    if old.amount is distinct from new.amount
       and old.status in ('pending', 'overdue')
       and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Unpaid bill amount for ' || new.tenant_name || ' was changed from ₹' || old.amount || ' to ₹' || new.amount || '.'
      );
    end if;
    if old.status in ('pending', 'overdue') and new.status = 'paid' then
      perform public.write_activity_log(new.hostel_id, 'payment', '₹' || new.amount || ' received from ' || new.tenant_name);
    end if;
    if old.status = 'paid' and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Payment of ₹' || new.amount || ' undone for ' || new.tenant_name
      );
    end if;
    if old.status is distinct from 'overdue' and new.status = 'overdue' then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Rent overdue for ' || new.tenant_name || ', Room ' || new.room_number
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'payment',
      'WARNING: Payment record of ₹' || old.amount || ' for ' || old.tenant_name || ' was permanently deleted.'
    );
    return old;
  end if;
  return null;
end
$$;

commit;
