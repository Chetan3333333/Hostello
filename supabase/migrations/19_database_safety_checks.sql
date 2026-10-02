-- 19: Missing safety checks, enforced by the database (fix #13).
--
-- The safe functions already check a lot, but four things were still possible
-- for anything writing straight to the tables - a script, an AI tool, or a
-- future code change:
--   1. moving or swapping a tenant who has already checked out;
--   2. changing the amount of a bill that is already paid, written off or
--      cancelled, which rewrites a money record;
--   3. moving a bill to a different tenant or a different month;
--   4. creating a new bill for a tenant who has already left.
--
-- Collecting arrears from someone who has left stays possible: recording a part
-- payment on their old bill creates a leftover bill, and that is allowed.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/19_database_safety_checks.down.sql

-- 1. A tenant who has checked out cannot be moved into a room.
create or replace function public.guard_tenant_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not old.is_active and not new.is_active
     and new.room_id is distinct from old.room_id then
    raise exception 'Cannot move %: they have already checked out', old.name
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

drop trigger if exists trigger_guard_tenant_changes on public.tenants;
create trigger trigger_guard_tenant_changes
before update on public.tenants
for each row execute function public.guard_tenant_changes();

-- 2 and 3, added to the existing payment guard (the earlier rules are kept).
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

  -- new in migration 19
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
$$;

-- 4. No new bill for a tenant who has left. A leftover bill from a part payment
--    is still allowed, so arrears can be collected after checkout.
create or replace function public.guard_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tenant_active boolean;
begin
  if new.is_remainder then
    return new;
  end if;

  select t.is_active into tenant_active from public.tenants t where t.id = new.tenant_id;

  if tenant_active is null then
    raise exception 'Cannot create a bill: the tenant does not exist'
      using errcode = 'check_violation';
  end if;

  if not tenant_active then
    raise exception 'Cannot create a bill for %: they have already checked out', new.tenant_name
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists trigger_guard_payment_insert on public.payments;
create trigger trigger_guard_payment_insert
before insert on public.payments
for each row execute function public.guard_payment_insert();
