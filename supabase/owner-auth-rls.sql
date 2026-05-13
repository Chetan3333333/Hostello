-- Hostello owner auth + RLS setup
--
-- Run this file in Supabase Dashboard > SQL Editor after creating the first
-- owner user in Authentication > Users.
--
-- After the owner user exists, replace the UUID below and run this mapping:
--
-- insert into public.owner_profiles (user_id, hostel_id)
-- values ('PASTE_OWNER_AUTH_USER_UUID_HERE', 'h1')
-- on conflict (user_id) do update set hostel_id = excluded.hostel_id;

create table if not exists public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hostel_id text not null references public.hostels(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (hostel_id)
);

alter table public.hostels drop column if exists pin;

alter table public.owner_profiles enable row level security;
alter table public.hostels enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.payments enable row level security;
alter table public.staff enable row level security;

create or replace function public.current_owner_hostel_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select hostel_id
  from public.owner_profiles
  where user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_owner_hostel_id() to authenticated;

drop policy if exists "Owners can read own profile" on public.owner_profiles;
drop policy if exists "Public can read hostel listings" on public.hostels;
drop policy if exists "Owners can update own hostel" on public.hostels;
drop policy if exists "Public can read room availability" on public.rooms;
drop policy if exists "Owners can insert own rooms" on public.rooms;
drop policy if exists "Owners can update own rooms" on public.rooms;
drop policy if exists "Owners can delete own rooms" on public.rooms;
drop policy if exists "Owners can read own tenants" on public.tenants;
drop policy if exists "Owners can insert own tenants" on public.tenants;
drop policy if exists "Owners can update own tenants" on public.tenants;
drop policy if exists "Owners can delete own tenants" on public.tenants;
drop policy if exists "Owners can read own payments" on public.payments;
drop policy if exists "Owners can insert own payments" on public.payments;
drop policy if exists "Owners can update own payments" on public.payments;
drop policy if exists "Owners can delete own payments" on public.payments;
drop policy if exists "Owners can read own staff" on public.staff;
drop policy if exists "Owners can insert own staff" on public.staff;
drop policy if exists "Owners can update own staff" on public.staff;
drop policy if exists "Owners can delete own staff" on public.staff;

create policy "Owners can read own profile"
on public.owner_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "Public can read hostel listings"
on public.hostels
for select
to anon, authenticated
using (true);

create policy "Owners can update own hostel"
on public.hostels
for update
to authenticated
using (id = public.current_owner_hostel_id())
with check (id = public.current_owner_hostel_id());

create policy "Public can read room availability"
on public.rooms
for select
to anon, authenticated
using (true);

create policy "Owners can insert own rooms"
on public.rooms
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can update own rooms"
on public.rooms
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can delete own rooms"
on public.rooms
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

create policy "Owners can read own tenants"
on public.tenants
for select
to authenticated
using (hostel_id = public.current_owner_hostel_id());

create policy "Owners can insert own tenants"
on public.tenants
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can update own tenants"
on public.tenants
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can delete own tenants"
on public.tenants
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

create policy "Owners can read own payments"
on public.payments
for select
to authenticated
using (hostel_id = public.current_owner_hostel_id());

create policy "Owners can insert own payments"
on public.payments
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can update own payments"
on public.payments
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

create policy "Owners can delete own payments"
on public.payments
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

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
