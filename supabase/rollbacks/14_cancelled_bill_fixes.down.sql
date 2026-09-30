-- Rollback for migrations/14_cancelled_bill_fixes.sql
-- Returns the database to the state right after migration 13.
-- Runs as one block: if the first check stops it, nothing is undone.
--
-- Note: the old rule allows only one original bill per tenant per month,
-- counting cancelled ones, so it refuses to be restored while any month has
-- both a cancelled bill and a replacement.

begin;

do $$
declare
  clashes integer;
begin
  select count(*) into clashes from (
    select tenant_id, month from public.payments
    where not is_remainder group by tenant_id, month having count(*) > 1
  ) x;
  if clashes > 0 then
    raise exception 'Cannot roll back: % month(s) have a cancelled bill plus a replacement. Remove the extra bills first.', clashes;
  end if;
end
$$;

drop index if exists public.payments_original_monthly_bill_unique;
create unique index if not exists payments_original_monthly_bill_unique
  on public.payments (tenant_id, month)
  where (not is_remainder);

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

commit;
