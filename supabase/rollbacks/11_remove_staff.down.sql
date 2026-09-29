-- Rollback for migrations/11_remove_staff.sql
--
-- Recreates an EMPTY staff table and its functions, access rules and trigger,
-- exactly as migrations 00, 02, 07, 08, 09 and the former owner-auth-rls.sql describe
-- them. Safe to run more than once.
--
-- Not restored: staff data (the owner confirmed it is not needed) and the
-- production-only redesign (staff_payments, generate_staff_salaries,
-- log_staff_payment_activity), which was never in this repository.
-- Only useful together with reverting the Phase 1 code change (b97cb0f),
-- because the current website no longer has a Staff page.

-- Table (migration 00)
create table if not exists public.staff (
  id text primary key,
  hostel_id text not null references public.hostels(id),
  name text not null,
  role text not null,
  phone text not null,
  salary integer not null default 0,
  join_date date not null,
  status text not null default 'present',
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Rules on the data (migration 07)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_valid_values') then
    alter table public.staff add constraint staff_valid_values check (
      salary >= 0
      and role in ('mess_cook', 'helper', 'cleaning', 'security', 'warden')
      and status in ('present', 'absent', 'leave')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_phone_format') then
    alter table public.staff add constraint staff_phone_format
      check (phone ~ '^[0-9]{10}$') not valid;
  end if;
end
$$;

-- Index (migration 02)
create index if not exists idx_staff_hostel_id on public.staff (hostel_id);

-- Access rules (from the former owner-auth-rls.sql)
alter table public.staff enable row level security;
drop policy if exists "Owners can read own staff" on public.staff;
drop policy if exists "Owners can insert own staff" on public.staff;
drop policy if exists "Owners can update own staff" on public.staff;
drop policy if exists "Owners can delete own staff" on public.staff;

create policy "Owners can read own staff"
on public.staff
for select
to authenticated
using (hostel_id = public.current_owner_hostel_id());

create policy "Owners can insert own staff"
on public.staff
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can update own staff"
on public.staff
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can delete own staff"
on public.staff
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

-- Balance function (migration 08)
create or replace function public.adjust_staff_balance(
  p_staff_id text,
  p_delta numeric,
  p_reason text
)
returns numeric
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_balance numeric;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'Staff balance adjustment must be non-zero';
  end if;

  update public.staff
  set balance = balance + p_delta
  where id = p_staff_id
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'Staff member does not exist or is not accessible';
  end if;

  return new_balance;
end
$$;

-- Activity-log trigger (migration 09)
create or replace function public.log_staff_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity_log(new.hostel_id, 'staff', new.name || ' joined the hostel staff as ' || new.role);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.balance is distinct from new.balance then
      if new.balance > old.balance then
        perform public.write_activity_log(
          new.hostel_id, 'staff',
          'Salary of ₹' || (new.balance - old.balance) || ' added for ' || new.name
        );
      else
        perform public.write_activity_log(
          new.hostel_id, 'staff',
          'Cash payment of ₹' || (old.balance - new.balance) || ' recorded for ' || new.name
        );
      end if;
    end if;
    if old.salary is distinct from new.salary then
      perform public.write_activity_log(
        new.hostel_id, 'staff',
        'WARNING: ' || new.name || '''s monthly salary was changed from ₹' || old.salary || ' to ₹' || new.salary || '.'
      );
    end if;
    if old.status is distinct from new.status then
      perform public.write_activity_log(new.hostel_id, 'staff', new.name || ' was marked as ' || new.status);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'staff',
      'WARNING: Staff member ' || old.name || ' was permanently removed.'
    );
    return old;
  end if;
  return null;
end
$$;

drop trigger if exists trigger_staff_activity on public.staff;
create trigger trigger_staff_activity
after insert or update or delete on public.staff
for each row execute function public.log_staff_activity();

-- Permissions (migration 09): only logged-in owners may call the balance
-- function; nobody may call the trigger function directly.
revoke execute on function public.adjust_staff_balance(text, numeric, text) from public, anon, authenticated;
grant execute on function public.adjust_staff_balance(text, numeric, text) to authenticated;
revoke execute on function public.log_staff_activity() from public, anon, authenticated;
