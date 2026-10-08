-- Rollback for migrations/21_profile_and_rating_lock.sql
-- Brings back the rating column (empty) and lets the owner update every column
-- of their own hostel again.

alter table public.hostels add column if not exists rating numeric default 0;

revoke update on public.hostels from authenticated;
grant update on public.hostels to authenticated;
