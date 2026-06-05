-- Production schema hardening and safe live-data repair.

alter table public.rooms
  add column if not exists is_archived boolean not null default false;

alter table public.payments
  add column if not exists source text not null default 'manual',
  add column if not exists is_remainder boolean not null default false;

alter table public.activity_logs
  add column if not exists actor_user_id uuid,
  add column if not exists actor_type text not null default 'system';

-- Restore defaults that older JSON-record RPCs bypassed.
update public.tenants
set created_at = coalesce(check_in_date::timestamptz, now())
where created_at is null;

update public.payments
set created_at = coalesce(paid_date::timestamptz, due_date::timestamptz, now())
where created_at is null;

update public.rooms set amenities = '[]'::jsonb where amenities is null;
update public.rooms set has_attached_bath = false where has_attached_bath is null;
update public.rooms set has_ac = false where has_ac is null;
update public.rooms set maintenance_notes = '' where maintenance_notes is null;

update public.payments
set source = case
  when id like 'pay-cron-%' or receipt_note like 'Automated monthly rent for %' then 'cron'
  when id like 'p-%' then 'check_in'
  else 'manual'
end
where source is null or source = 'manual';

-- Preserve split-payment history while identifying one original monthly bill.
with ranked as (
  select id,
    row_number() over (
      partition by tenant_id, month
      order by created_at nulls last, id
    ) as row_number
  from public.payments
)
update public.payments p
set is_remainder = true,
    source = 'split'
from ranked r
where p.id = r.id
  and r.row_number > 1;

-- Duplicate room records with no active tenants are retained for historical
-- foreign-key references, but removed from operational inventory.
do $$
begin
  if exists (
    with ranked as (
      select r.id,
        row_number() over (
          partition by r.hostel_id, r.number
          order by (
            select count(*) from public.tenants t
            where t.room_id = r.id and t.is_active
          ) desc, r.created_at desc nulls last, r.id
        ) as row_number
      from public.rooms r
      where not r.is_archived
    )
    select 1
    from ranked d
    join public.tenants t on t.room_id = d.id and t.is_active
    where d.row_number > 1
  ) then
    raise exception 'Cannot archive duplicate rooms while more than one duplicate has active tenants';
  end if;
end
$$;

with ranked as (
  select r.id,
    row_number() over (
      partition by r.hostel_id, r.number
      order by (
        select count(*) from public.tenants t
        where t.room_id = r.id and t.is_active
      ) desc, r.created_at desc nulls last, r.id
    ) as row_number
  from public.rooms r
  where not r.is_archived
)
update public.rooms r
set number = r.number || ' [archived ' || right(r.id, 6) || ']',
    is_archived = true,
    status = 'maintenance',
    maintenance_notes = trim(both from concat_ws(
      ' ',
      nullif(r.maintenance_notes, ''),
      'Archived duplicate room record; historical tenant references retained.'
    ))
from ranked d
where r.id = d.id
  and d.row_number > 1;

update public.hostels h
set total_rooms = (
  select count(*)::integer
  from public.rooms r
  where r.hostel_id = h.id
    and not r.is_archived
);

alter table public.rooms
  alter column hostel_id set not null,
  alter column floor set not null,
  alter column type set not null,
  alter column price set not null,
  alter column status set not null,
  alter column capacity set not null,
  alter column current_occupants set not null,
  alter column current_occupants set default 0,
  alter column amenities set not null,
  alter column amenities set default '[]'::jsonb,
  alter column has_attached_bath set not null,
  alter column has_attached_bath set default false,
  alter column has_ac set not null,
  alter column has_ac set default false,
  alter column maintenance_notes set not null,
  alter column maintenance_notes set default '',
  alter column created_at set not null,
  alter column created_at set default now();

alter table public.tenants
  alter column hostel_id set not null,
  alter column room_id set not null,
  alter column room_number set not null,
  alter column phone set not null,
  alter column rent_amount set not null,
  alter column security_deposit set not null,
  alter column check_in_date set not null,
  alter column is_active set not null,
  alter column is_active set default true,
  alter column created_at set not null,
  alter column created_at set default now();

alter table public.payments
  alter column hostel_id set not null,
  alter column tenant_id set not null,
  alter column tenant_name set not null,
  alter column room_number set not null,
  alter column amount set not null,
  alter column month set not null,
  alter column due_date set not null,
  alter column status set not null,
  alter column status set default 'pending',
  alter column created_at set not null,
  alter column created_at set default now();

alter table public.staff
  alter column hostel_id set not null,
  alter column role set not null,
  alter column phone set not null,
  alter column salary set not null,
  alter column join_date set not null,
  alter column status set not null,
  alter column status set default 'present',
  alter column created_at set not null,
  alter column created_at set default now();

alter table public.hostels
  alter column total_rooms set default 0,
  alter column created_at set not null,
  alter column created_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_valid_values') then
    alter table public.rooms add constraint rooms_valid_values check (
      floor >= 0 and price >= 0 and capacity > 0
      and current_occupants between 0 and capacity
      and status in ('available', 'occupied', 'maintenance')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_valid_values') then
    alter table public.tenants add constraint tenants_valid_values check (
      rent_amount >= 0
      and security_deposit >= 0
      and (check_out_date is null or check_out_date >= check_in_date)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_phone_format') then
    alter table public.tenants add constraint tenants_phone_format
      check (phone ~ '^[0-9]{10}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_valid_values') then
    alter table public.payments add constraint payments_valid_values check (
      amount > 0
      and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      and to_char(due_date, 'YYYY-MM') = month
      and status in ('paid', 'pending', 'overdue', 'written_off')
      and source in ('manual', 'check_in', 'cron', 'split')
    );
  end if;
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
  if not exists (select 1 from pg_constraint where conname = 'activity_logs_valid_values') then
    alter table public.activity_logs add constraint activity_logs_valid_values check (
      type in ('system', 'payment', 'tenant', 'room', 'staff')
      and actor_type in ('owner', 'system')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'owner_profiles_owner_role') then
    alter table public.owner_profiles add constraint owner_profiles_owner_role check (role = 'owner');
  end if;
end
$$;

create unique index if not exists rooms_hostel_number_unique
  on public.rooms(hostel_id, lower(btrim(number)));
create unique index if not exists tenants_active_phone_unique
  on public.tenants(hostel_id, phone) where is_active;
create unique index if not exists payments_original_monthly_bill_unique
  on public.payments(tenant_id, month) where not is_remainder;
create index if not exists activity_logs_hostel_created_id_idx
  on public.activity_logs(hostel_id, created_at desc, id desc);

create or replace function public.current_owner_hostel_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select hostel_id
  from public.owner_profiles
  where user_id = auth.uid()
    and role = 'owner'
  limit 1
$$;

alter table public.owner_profiles enable row level security;
alter table public.hostels enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.payments enable row level security;
alter table public.staff enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "Owners can update own profile" on public.owner_profiles;
drop policy if exists "Public can read room availability" on public.rooms;
drop policy if exists "Public can read active room availability" on public.rooms;
drop policy if exists "Owners can read own rooms" on public.rooms;

create policy "Public can read active room availability"
on public.rooms for select to anon
using (not is_archived);

create policy "Owners can read own rooms"
on public.rooms for select to authenticated
using (hostel_id = public.current_owner_hostel_id());

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'activity_logs'
  loop
    execute format('drop policy if exists %I on public.activity_logs', policy_record.policyname);
  end loop;
end
$$;

create policy "Owners can read own activity logs"
on public.activity_logs for select to authenticated
using (hostel_id = public.current_owner_hostel_id());

revoke all on public.activity_logs from public, anon, authenticated;
grant select on public.activity_logs to authenticated;

revoke select on public.rooms from anon;
grant select (
  id, hostel_id, number, floor, type, price, status, capacity,
  current_occupants, amenities, has_attached_bath, has_ac, is_archived
) on public.rooms to anon;
