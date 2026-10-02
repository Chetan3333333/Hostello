-- Rollback for migrations/19_database_safety_checks.sql
-- Removes the four extra rules and restores the payment guard as migration 14
-- left it.

drop trigger if exists trigger_guard_tenant_changes on public.tenants;
drop function if exists public.guard_tenant_changes();

drop trigger if exists trigger_guard_payment_insert on public.payments;
drop function if exists public.guard_payment_insert();

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
