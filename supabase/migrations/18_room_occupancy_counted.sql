-- 18: The database counts how many people are in each room (fix #12).
--
-- Before: rooms.current_occupants was a number kept by hand. Four separate
-- actions had to remember to adjust it (adding a tenant, moving a tenant,
-- swapping two tenants, checking out). One slip and a full room shows as empty
-- or an empty room as full. The repair script scripts/fixRoomStatuses.js exists
-- because this has drifted before.
--
-- After: the number is always counted from the tenants themselves.
--   * a trigger on tenants pushes a refresh to every room involved;
--   * a trigger on rooms recomputes the count on any insert or update, so a
--     wrong value cannot be stored even by a script, an AI tool or old code.
-- The room status follows the same rule: 'maintenance' stays whatever the owner
-- set, otherwise it is 'occupied' when the room is full and 'available' when it
-- is not.
--
-- The existing functions are left untouched: the arithmetic they still do is
-- simply corrected the moment it is written.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/18_room_occupancy_counted.down.sql

-- 1. Any write to a room stores the true count and the matching status.
create or replace function public.sync_room_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  real_count integer;
begin
  select count(*) into real_count
  from public.tenants t
  where t.room_id = new.id
    and t.is_active;

  new.current_occupants := real_count;

  if new.status is distinct from 'maintenance' then
    new.status := case when real_count >= new.capacity then 'occupied' else 'available' end;
  end if;

  return new;
end
$$;

drop trigger if exists trigger_sync_room_occupancy on public.rooms;
create trigger trigger_sync_room_occupancy
before insert or update on public.rooms
for each row execute function public.sync_room_occupancy();

-- 2. Any change to a tenant refreshes the rooms involved.
create or replace function public.refresh_rooms_after_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.room_id is not null then
    update public.rooms set id = id where id = old.room_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.room_id is not null
     and (tg_op = 'INSERT' or new.room_id is distinct from old.room_id
          or new.is_active is distinct from old.is_active) then
    update public.rooms set id = id where id = new.room_id;
  end if;
  return null;
end
$$;

drop trigger if exists trigger_refresh_rooms_after_tenant_change on public.tenants;
create trigger trigger_refresh_rooms_after_tenant_change
after insert or update or delete on public.tenants
for each row execute function public.refresh_rooms_after_tenant_change();

-- 3. Correct anything that may already have drifted.
update public.rooms set id = id;
