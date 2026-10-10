-- 22: "Write off" is removed from the product. Cancel Bill is the only way to
--     clear a bill that should not be collected.
--
-- Why:
--   The owner had two buttons that looked alike and meant different things.
--   One clear button is safer than two confusing ones. The app change landed
--   first (commit d0e63be, merged as 171bc9d); this makes the database agree,
--   so no screen, no script and no future tool can create a written-off bill
--   again by mistake.
--
-- What changes:
--   1. 'written_off' is no longer an allowed payment status.
--   2. guard_payment_changes stops mentioning it. No behaviour changes: a
--      status that cannot exist can never trigger those rules.
--   3. log_payment_activity stops mentioning it, for the same reason.
--
-- What deliberately does NOT change:
--   * Activity log lines already written about past write-offs stay exactly as
--     they are. The log is append-only on purpose: it records what really
--     happened and must not be rewritten.
--   * Migrations 01, 07, 09, 13, 14 and 19 still mention 'written_off'. They
--     are history and are replayed in order on a rebuild; this file tightens
--     the rule at the end. Never edit an old migration.
--
-- IMPORTANT, before you run this:
--   Any backup taken BEFORE this migration may contain written-off bills.
--   restore.js writes rows straight back into the table, so the database would
--   now refuse them. Take a fresh backup AFTER this migration and treat it as
--   your new baseline.
--
-- Safe to run more than once.
-- Refuses rather than destroys: if a written-off bill still exists, it stops
-- and tells you, instead of silently changing or dropping that bill.
-- Rollback: supabase/rollbacks/22_remove_write_off.down.sql

do $$
declare
  leftover integer;
begin
  select count(*) into leftover from public.payments where status = 'written_off';
  if leftover > 0 then
    raise exception
      'Cannot remove the write-off status: % bill(s) still use it. Open those bills in the app and Cancel them first, then run this migration again.',
      leftover
      using errcode = 'check_violation';
  end if;
end $$;

-- 1. The allowed statuses, minus 'written_off'. Everything else in this rule
--    is unchanged from migration 17.
alter table public.payments drop constraint if exists payments_valid_values;
alter table public.payments add constraint payments_valid_values check (
  amount > 0
  and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  and to_char(due_date::timestamptz, 'YYYY-MM') = month
  and status in ('paid', 'pending', 'overdue', 'cancelled')
  and source in ('manual', 'check_in', 'cron', 'split')
);

-- 2. The payment guards, with the dead 'written_off' branches removed.
create or replace function public.guard_payment_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  tenant_active boolean;
begin
  if old.status in ('paid', 'cancelled') and new.status in ('pending', 'overdue') then
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

  if old.status in ('paid', 'cancelled')
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

-- 3. The audit logger, with the two dead write-off branches removed.
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
       and old.status not in ('paid', 'cancelled') then
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
