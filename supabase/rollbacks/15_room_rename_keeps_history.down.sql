-- Rollback for migrations/15_room_rename_keeps_history.sql
-- Restores the previous behaviour, where renaming a room rewrote the room
-- number on every matching bill in the hostel, history included.

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
    update public.tenants
    set room_number = next_number
    where room_id = p_room_id;

    update public.payments
    set room_number = next_number
    where hostel_id = room_record.hostel_id
      and room_number = room_record.number;
  end if;
end
$$;
