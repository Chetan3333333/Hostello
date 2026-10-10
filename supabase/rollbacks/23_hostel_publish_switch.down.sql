-- Rollback for 23_hostel_publish_switch.sql
--
-- Puts the public read rules back to "every hostel and every room is public",
-- which is how the site behaved before migration 23.
--
-- This rollback does NOT drop the is_published column. Dropping it would
-- throw away each owner's choice, and the column is harmless once the rules
-- above no longer consult it. If you are certain you want it gone, the
-- statement is at the bottom, commented out, so it cannot run by accident.
--
-- WARNING: after this rollback, any hostel the owner had hidden becomes
-- visible to students again. Check with the owners first.
--
-- Safe to run more than once.

drop policy if exists "Public can read published hostels" on public.hostels;
drop policy if exists "Owners can read their own hostel" on public.hostels;
drop policy if exists "Public can read hostel listings" on public.hostels;
create policy "Public can read hostel listings"
  on public.hostels for select to anon, authenticated
  using (true);

drop policy if exists "Public can read rooms of published hostels" on public.rooms;
drop policy if exists "Public can read active room availability" on public.rooms;
create policy "Public can read active room availability"
  on public.rooms for select to anon
  using (not is_archived);

-- Deliberately NOT run. Uncomment only if you really want to discard every
-- owner's published/hidden choice:
-- alter table public.hostels drop column if exists is_published;
