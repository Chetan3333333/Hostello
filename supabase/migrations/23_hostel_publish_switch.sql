-- 23: A hostel is only shown to students when its owner publishes it.
--
-- Why:
--   * A hostel being set up appears on the public website half finished -
--     wrong room count, blank amenities, no phone number - while the owner is
--     still typing it in.
--   * An owner who is full should be able to take his listing down.
--   * A demo hostel used for testing should never appear to students.
--
-- What changes:
--   1. hostels gains is_published. NEW hostels start hidden (default false),
--      so nothing is ever shown before its owner is ready.
--   2. Hostels that exist TODAY are set to published, so nothing disappears
--      from the website the moment this runs. A migration should never change
--      what anyone sees; the owner decides that from the app.
--   3. Students (anon) see only published hostels, and only the rooms of
--      published hostels.
--   4. The owner always sees his OWN hostel, published or not. Without this
--      the whole owner dashboard would go blank the moment he unpublished -
--      the app reads the hostel row to draw every page.
--   5. The owner is allowed to write the new column. Migration 21 limited
--      hostel updates to a named list of columns, so without this grant the
--      new checkbox would silently fail to save.
--
-- Note on the two separate read rules: current_owner_hostel_id() may only be
-- run by signed-in users. If a single rule called it, every logged-out visitor
-- would hit a permission error and the public site would break. So students
-- and owners get one rule each.
--
-- Safe to run more than once: re-running will NOT re-publish a hostel the
-- owner has deliberately hidden.
-- Rollback: supabase/rollbacks/23_hostel_publish_switch.down.sql

do $$
declare
  column_already_there boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hostels' and column_name = 'is_published'
  ) into column_already_there;

  if not column_already_there then
    alter table public.hostels add column is_published boolean not null default false;
    -- Preserve exactly what is on the website today.
    update public.hostels set is_published = true;
  end if;
end $$;

-- The owner may change the switch. Everything migration 21 allowed stays
-- allowed; this only adds the new column.
grant update (is_published) on public.hostels to authenticated;

-- Students see published hostels only.
drop policy if exists "Public can read hostel listings" on public.hostels;
drop policy if exists "Public can read published hostels" on public.hostels;
create policy "Public can read published hostels"
  on public.hostels for select to anon
  using (is_published);

-- A signed-in owner sees published hostels and, always, his own.
drop policy if exists "Owners can read their own hostel" on public.hostels;
create policy "Owners can read their own hostel"
  on public.hostels for select to authenticated
  using (is_published or id = current_owner_hostel_id());

-- Rooms follow the hostel. An unpublished hostel's rooms are not public
-- either. The owner keeps reading his own rooms through his own rule.
drop policy if exists "Public can read active room availability" on public.rooms;
drop policy if exists "Public can read rooms of published hostels" on public.rooms;
create policy "Public can read rooms of published hostels"
  on public.rooms for select to anon
  using (
    not is_archived
    and exists (
      select 1 from public.hostels h
      where h.id = rooms.hostel_id and h.is_published
    )
  );
