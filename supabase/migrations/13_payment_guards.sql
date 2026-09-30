-- 13: Safer undo and cancel for bills (fix #7).
--
-- Three changes, all in the database so they apply to the app, to scripts and
-- to any tool:
--   1. bills can now be "cancelled" (kept and visible, but not counted);
--   2. a bill cannot be un-paid for a tenant who has already checked out, and a
--      paid bill cannot be cancelled or a cancelled bill paid without going
--      through the unpaid state first;
--   3. reversals and cancellations are written into the activity history.
--
-- Nothing else changes: the nightly job already skips a month that has a bill,
-- so a cancelled bill is not recreated; paying is already limited to pending
-- and overdue bills; checkout only blocks on pending and overdue bills; and the
-- dashboard totals only count paid, pending and overdue.
--
-- Safe to run more than once. Rollback: supabase/rollbacks/13_payment_guards.down.sql

-- 1. Allow the new status.
alter table public.payments drop constraint if exists payments_valid_values;
alter table public.payments add constraint payments_valid_values check (
  amount > 0
  and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  and to_char(due_date, 'YYYY-MM') = month
  and status in ('paid', 'pending', 'overdue', 'written_off', 'cancelled')
  and source in ('manual', 'check_in', 'cron', 'split')
);

-- 2. Guards that cannot be bypassed by the app or by any tool.
create or replace function public.guard_payment_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tenant_active boolean;
begin
  if old.status in ('paid', 'written_off') and new.status in ('pending', 'overdue') then
    select t.is_active into tenant_active from public.tenants t where t.id = old.tenant_id;
    if tenant_active is distinct from true then
      raise exception 'Cannot undo this bill: % has already checked out', old.tenant_name
        using errcode = 'check_violation';
    end if;
  end if;

  if old.status = 'paid' and new.status = 'cancelled' then
    raise exception 'Undo the payment before cancelling this bill (%, %)', old.tenant_name, old.month
      using errcode = 'check_violation';
  end if;

  if old.status = 'cancelled' and new.status = 'paid' then
    raise exception 'Restore this cancelled bill before marking it paid (%, %)', old.tenant_name, old.month
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists trigger_payment_guards on public.payments;
create trigger trigger_payment_guards
before update on public.payments
for each row execute function public.guard_payment_changes();

-- 3. History: record reversals and cancellations (replaces the version in
--    migration 09; the earlier lines are unchanged).
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
    if old.status = 'written_off' and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Write-off of ₹' || new.amount || ' for ' || new.tenant_name || ' (' || new.month || ') was reversed; the bill is unpaid again'
      );
    end if;
    if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'Bill of ₹' || new.amount || ' for ' || new.tenant_name || ' (' || new.month || ') was cancelled'
      );
    end if;
    if old.status = 'cancelled' and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'Cancelled bill of ₹' || new.amount || ' for ' || new.tenant_name || ' (' || new.month || ') was restored'
      );
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
        'WARNING: Payment of ₹' || new.amount || ' undone for ' || new.tenant_name || ' (' || new.month || ')'
      );
    end if;
    if old.status is distinct from 'overdue' and new.status = 'overdue'
       and old.status not in ('paid', 'written_off', 'cancelled') then
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