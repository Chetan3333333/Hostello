-- 15: Renaming a room must not rewrite history (fix #9).
--
-- Before: renaming Room 101 to 201 changed the room number on EVERY bill in the
-- hostel that said 101 - paid bills, bills of tenants who had already left, and
-- even bills of an older room that happened to use the same number. Tenant
-- records of former occupants were rewritten too.
--
-- After: only the current month's unpaid bills of the tenants living in that
-- room right now are updated, so rent reminders show the correct room. Anything
-- older, anything already paid, and records of former tenants are left exactly
-- as they were.
--
-- Only the renaming part of update_room_transaction changes; the rest of the
-- function is unchanged.
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/15_room_rename_keeps_history.down.sql

create or replace function public.update_room_transaction(
  p_room_id text,
  p_updates jsonb,
  p_rename boolean
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  room_record public.rooms%rowtype;
  next_capacity integer;
  next_status text;
  next_number text;
begin
  select *
  into room_record
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room does not exist or is not accessible';
  end if;
  if room_record.is_archived then
    raise exception 'Archived room records cannot be edited';
  end if;

  next_capacity := case
    when p_updates ? 'capacity' then (p_updates->>'capacity')::integer
    else room_record.capacity
  end;
  next_number := case
    when p_updates ? 'number' then nullif(trim(p_updates->>'number'), '')
    else room_record.number
  end;

  if next_number is null then
    raise exception 'Room number is required';
  end if;
  if next_capacity < room_record.current_occupants then
    raise exception 'Room capacity cannot be lower than its current occupancy';
  end if;

  next_status := case
    when p_updates ? 'status' and p_updates->>'status' = 'maintenance' then 'maintenance'
    when p_updates ? 'status' then
      case when room_record.current_occupants >= next_capacity then 'occupied' else 'available' end
    else room_record.status
  end;

  update public.rooms
  set number = next_number,
      capacity = next_capacity,
      price = case when p_updates ? 'price' then (p_updates->>'price')::integer else price end,
      type = case when p_updates ? 'type' then p_updates->>'type' else type end,
      floor = case when p_updates ? 'floor' then (p_updates->>'floor')::integer else floor end,
      has_ac = case when p_updates ? 'has_ac' then (p_updates->>'has_ac')::boolean else has_ac end,
      has_attached_bath = case when p_updates ? 'has_attached_bath' then (p_updates->>'has_attached_bath')::boolean else has_attached_bath end,
      amenities = case when p_updates ? 'amenities' then p_updates->'amenities' else amenities end,
      status = next_status,
      maintenance_notes = case when p_updates ? 'maintenance_notes' then p_updates->>'maintenance_notes' else maintenance_notes end
  where id = p_room_id;

  if p_rename and next_number is distinct from room_record.number then
    -- Only tenants living in the room right now. Records of tenants who have
    -- already left keep the room number they had at the time.
    update public.tenants
    set room_number = next_number
    where room_id = p_room_id
      and is_active;

    -- Only bills of the current month that are still unpaid, and only for the
    -- tenants living in this room right now. Everything older, everything
    -- already paid, and bills of former tenants keep the old room number,
    -- because they are history.
    update public.payments p
    set room_number = next_number
    where p.hostel_id = room_record.hostel_id
      and p.status in ('pending', 'overdue')
      and p.month = to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM')
      and p.tenant_id in (
        select t.id from public.tenants t
        where t.room_id = p_room_id and t.is_active
      );
  end if;
end
$$;
