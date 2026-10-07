-- 21: The owner can edit their profile, but not the parts the system owns.
--
-- Before:
--   * saving the hostel profile sent the whole record back, including the room
--     count the screen had copied when it opened, so an out-of-date count could
--     overwrite the correct one;
--   * the owner could set their own public star rating.
--
-- After:
--   * the rating is gone from the product entirely (the owner's decision), so
--     the column is dropped;
--   * the database only accepts updates to the fields the profile screen shows.
--     total_rooms, id and created_at cannot be written by the app at all, no
--     matter what any screen or tool sends. total_rooms stays accurate because
--     the existing trigger maintains it.
--
-- Run this AFTER the matching app change is deployed: the old screen sends
-- total_rooms and rating, which this migration no longer accepts.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/21_profile_and_rating_lock.down.sql

alter table public.hostels drop column if exists rating;

revoke update on public.hostels from authenticated;
grant update (
  name, type, address, phone, whatsapp, email,
  description, nearby_landmarks, amenities, rules, pricing, established
) on public.hostels to authenticated;
