-- 14: Two corrections to the "cancelled bill" work in migration 13.
-- Both were found by testing every feature end to end on a practice database.
--
--   1. A cancelled bill still occupied the month's slot, so after cancelling a
--      wrong bill the owner could not create a corrected one for that month.
--      The rule "one original bill per tenant per month" now ignores cancelled
--      bills. The nightly job is unaffected: it checks whether any bill exists
--      for the month, so it still does not recreate a cancelled one.
--
--   2. The guard from migration 13 blocked un-paying a paid or written-off bill
--      for a tenant who had checked out, but not restoring a cancelled one, so
--      a tenant who had left could end up owing money again.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/14_cancelled_bill_fixes.down.sql

-- 1. The month's slot is freed by cancelling.
drop index if exists public.payments_original_monthly_bill_unique;
create unique index if not exists payments_original_monthly_bill_unique
  on public.payments (tenant_id, month)
  where (not is_remainder and status <> 'cancelled');

-- 2. Restoring a cancelled bill is also blocked once the tenant has left.
create or replace function public.guard_payment_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  return new;
end
$$;
