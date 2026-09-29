-- Rollback for migrations/12_owner_access_rules.sql
--
-- WARNING: do NOT run this on the live database. It removes the rules that
-- let the owner see their hostel, rooms, tenants and payments; the app would
-- show nothing and owners could not work. It exists only to undo migration 12
-- on a test database built from these files. Safe to run more than once.

drop policy if exists "Owners can read own profile" on public.owner_profiles;
drop policy if exists "Public can read hostel listings" on public.hostels;
drop policy if exists "Owners can update own hostel" on public.hostels;
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
