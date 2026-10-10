-- Rollback for 22_remove_write_off.sql
--
-- Puts 'written_off' back as an allowed payment status and restores the two
-- functions to the way migration 19 left them.
--
-- This rollback is always safe: it only widens what the database accepts, so
-- no existing bill can become invalid and nothing is deleted. It does NOT
-- bring back the Write-off button, which lives in the app - redeploy the app
-- code from before commit d0e63be for that.
--
-- Safe to run more than once.

alter table public.payments drop constraint if exists payments_valid_values;
alter table public.payments add constraint payments_valid_values check (
  amount > 0
  and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  and to_char(due_date::timestamptz, 'YYYY-MM') = month
  and status in ('paid', 'pending', 'overdue', 'written_off', 'cancelled')
  and source in ('manual', 'check_in', 'cron', 'split')
);

create or replace function public.guard_payment_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  tenant_active boolean;
begin
  if old.status in ('paid', 'written_off', 'cancelled') and new.status in ('pending', 'overdue') then
    select t.is_active into tenant_active from public.tenants t where t.id = old.tenant_id;
    if tenant_active is distinct from true then
      raise exception 'Cannot reopen this bill: % has already checked out', old.tenant_name
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

  if old.status in ('paid', 'written_off', 'cancelled')
     and new.amount is distinct from old.amount then
    raise exception 'The amount of a % bill cannot be changed (%, %)', old.status, old.tenant_name, old.month
      using errcode = 'check_violation';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'A bill cannot be moved to another tenant'
      using errcode = 'check_violation';
  end if;

  if new.month is distinct from old.month then
    raise exception 'A bill cannot be moved to another month (%, %)', old.tenant_name, old.month
      using errcode = 'check_violation';
  end if;

  return new;
end
$function$;

create or replace function public.log_payment_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;
