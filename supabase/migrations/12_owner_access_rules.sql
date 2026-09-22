-- 12: Owner access rules (row-level security policies).
--
-- Until now these 14 rules lived only in supabase/owner-auth-rls.sql, outside
-- the numbered migrations. A database built from migrations 00-11 alone
-- therefore had security switched on (migration 07) but no rules allowing
-- access, so the owner could not see any hostel, tenant or payment.
-- This migration adds exactly those 14 rules, copied unchanged from that file,
-- and the same change removes that file.
--
-- The live database already has all of them, identical; nothing needs to be
-- run there. Safe to run more than once (each rule is dropped if present and
-- created again).
--
-- Rules already defined elsewhere, and therefore not repeated here:
--   rooms  "Public can read active room availability", "Owners can read own rooms" (07)
--   activity_logs "Owners can read own activity logs" (03 / 07)
--
-- Rollback: supabase/rollbacks/12_owner_access_rules.down.sql

-- Owner profile: an owner can see only their own profile row.
drop policy if exists "Owners can read own profile" on public.owner_profiles;
create policy "Owners can read own profile"
on public.owner_profiles
for select
to authenticated
using (user_id = auth.uid());

-- Hostels: everyone can read listings; an owner can edit only their own hostel.
drop policy if exists "Public can read hostel listings" on public.hostels;
create policy "Public can read hostel listings"
on public.hostels
for select
to anon, authenticated
using (true);

drop policy if exists "Owners can update own hostel" on public.hostels;
create policy "Owners can update own hostel"
on public.hostels
for update
to authenticated
using (id = public.current_owner_hostel_id())
with check (id = public.current_owner_hostel_id());

-- Rooms: an owner can add, edit and delete only their own rooms.
-- (Reading rooms is already covered in migration 07.)
drop policy if exists "Owners can insert own rooms" on public.rooms;
create policy "Owners can insert own rooms"
on public.rooms
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can update own rooms" on public.rooms;
create policy "Owners can update own rooms"
on public.rooms
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can delete own rooms" on public.rooms;
create policy "Owners can delete own rooms"
on public.rooms
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

-- Tenants: only the owner of the hostel can see or change them.
drop policy if exists "Owners can read own tenants" on public.tenants;
create policy "Owners can read own tenants"
on public.tenants
for select
to authenticated
using (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can insert own tenants" on public.tenants;
create policy "Owners can insert own tenants"
on public.tenants
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can update own tenants" on public.tenants;
create policy "Owners can update own tenants"
on public.tenants
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can delete own tenants" on public.tenants;
create policy "Owners can delete own tenants"
on public.tenants
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());

-- Payments: only the owner of the hostel can see or change them.
drop policy if exists "Owners can read own payments" on public.payments;
create policy "Owners can read own payments"
on public.payments
for select
to authenticated
using (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can insert own payments" on public.payments;
create policy "Owners can insert own payments"
on public.payments
for insert
to authenticated
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can update own payments" on public.payments;
create policy "Owners can update own payments"
on public.payments
for update
to authenticated
using (hostel_id = public.current_owner_hostel_id())
with check (hostel_id = public.current_owner_hostel_id());

drop policy if exists "Owners can delete own payments" on public.payments;
create policy "Owners can delete own payments"
on public.payments
for delete
to authenticated
using (hostel_id = public.current_owner_hostel_id());
