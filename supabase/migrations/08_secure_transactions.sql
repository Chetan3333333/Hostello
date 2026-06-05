-- Secure, concurrency-safe owner transactions.

create or replace function public.add_tenant_transaction(
  p_tenant jsonb,
  p_payment jsonb,
  p_room_updates jsonb,
  p_room_id text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  room_record public.rooms%rowtype;
  next_occupants integer;
begin
  select *
  into room_record
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Selected room does not exist or is not accessible';
  end if;
  if room_record.is_archived then
    raise exception 'Archived rooms cannot receive tenants';
  end if;
  if room_record.current_occupants >= room_record.capacity then
    raise exception 'Selected room is already full';
  end if;
  if p_tenant->>'hostel_id' is distinct from room_record.hostel_id
     or p_tenant->>'room_id' is distinct from room_record.id then
    raise exception 'Tenant and room do not belong to the same hostel';
  end if;

  insert into public.tenants (
    id, hostel_id, room_id, room_number, name, phone, email, college, year,
    parent_name, parent_phone, id_proof, id_number, rent_amount,
    security_deposit, check_in_date, is_active
  ) values (
    p_tenant->>'id',
    room_record.hostel_id,
    room_record.id,
    room_record.number,
    p_tenant->>'name',
    p_tenant->>'phone',
    nullif(p_tenant->>'email', ''),
    nullif(p_tenant->>'college', ''),
    nullif(p_tenant->>'year', ''),
    nullif(p_tenant->>'parent_name', ''),
    nullif(p_tenant->>'parent_phone', ''),
    nullif(p_tenant->>'id_proof', ''),
    nullif(p_tenant->>'id_number', ''),
    (p_tenant->>'rent_amount')::integer,
    (p_tenant->>'security_deposit')::integer,
    (p_tenant->>'check_in_date')::date,
    true
  );

  insert into public.payments (
    id, hostel_id, tenant_id, tenant_name, room_number, amount, month,
    due_date, paid_date, status, receipt_note, source, is_remainder
  ) values (
    p_payment->>'id',
    room_record.hostel_id,
    p_tenant->>'id',
    p_tenant->>'name',
    room_record.number,
    (p_payment->>'amount')::integer,
    p_payment->>'month',
    (p_payment->>'due_date')::date,
    null,
    'pending',
    coalesce(nullif(p_payment->>'receipt_note', ''), 'Initial rent bill'),
    'check_in',
    false
  );

  next_occupants := room_record.current_occupants + 1;
  update public.rooms
  set current_occupants = next_occupants,
      status = case
        when room_record.status = 'maintenance' then 'maintenance'
        when next_occupants >= capacity then 'occupied'
        else 'available'
      end
  where id = room_record.id;
end
$$;

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

create or replace function public.update_tenant_transaction(
  p_tenant_id text,
  p_tenant_updates jsonb,
  p_room_changed boolean,
  p_old_room_id text,
  p_new_room_id text,
  p_old_room_occupants integer,
  p_new_room_occupants integer,
  p_old_room_status text,
  p_new_room_status text,
  p_new_room_number text,
  p_rent_changed boolean,
  p_new_rent_amount numeric,
  p_current_month text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  tenant_record public.tenants%rowtype;
  old_room public.rooms%rowtype;
  new_room public.rooms%rowtype;
  can_sync_rent boolean := false;
begin
  select *
  into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant does not exist or is not accessible';
  end if;

  if p_room_changed then
    perform 1
    from public.rooms
    where id in (tenant_record.room_id, p_new_room_id)
    order by id
    for update;

    select * into old_room from public.rooms where id = tenant_record.room_id;
    select * into new_room from public.rooms where id = p_new_room_id;

    if new_room.id is null then
      raise exception 'Destination room does not exist or is not accessible';
    end if;
    if new_room.hostel_id is distinct from tenant_record.hostel_id then
      raise exception 'Destination room belongs to another hostel';
    end if;
    if new_room.is_archived then
      raise exception 'Destination room is not available for assignment';
    end if;
    if new_room.current_occupants >= new_room.capacity then
      raise exception 'Destination room is already full';
    end if;
  end if;

  if p_rent_changed then
    select count(*) <= 1
    into can_sync_rent
    from public.payments
    where tenant_id = p_tenant_id
      and month = p_current_month;
  end if;

  update public.tenants
  set name = case when p_tenant_updates ? 'name' then p_tenant_updates->>'name' else name end,
      phone = case when p_tenant_updates ? 'phone' then p_tenant_updates->>'phone' else phone end,
      email = case when p_tenant_updates ? 'email' then nullif(p_tenant_updates->>'email', '') else email end,
      college = case when p_tenant_updates ? 'college' then nullif(p_tenant_updates->>'college', '') else college end,
      year = case when p_tenant_updates ? 'year' then nullif(p_tenant_updates->>'year', '') else year end,
      parent_name = case when p_tenant_updates ? 'parent_name' then nullif(p_tenant_updates->>'parent_name', '') else parent_name end,
      parent_phone = case when p_tenant_updates ? 'parent_phone' then nullif(p_tenant_updates->>'parent_phone', '') else parent_phone end,
      id_proof = case when p_tenant_updates ? 'id_proof' then nullif(p_tenant_updates->>'id_proof', '') else id_proof end,
      id_number = case when p_tenant_updates ? 'id_number' then nullif(p_tenant_updates->>'id_number', '') else id_number end,
      room_id = case when p_room_changed then new_room.id else room_id end,
      room_number = case when p_room_changed then new_room.number else room_number end,
      rent_amount = case when p_tenant_updates ? 'rent_amount' then (p_tenant_updates->>'rent_amount')::integer else rent_amount end,
      security_deposit = case when p_tenant_updates ? 'security_deposit' then (p_tenant_updates->>'security_deposit')::integer else security_deposit end,
      check_in_date = case when p_tenant_updates ? 'check_in_date' then (p_tenant_updates->>'check_in_date')::date else check_in_date end
  where id = p_tenant_id;

  if p_room_changed then
    update public.rooms
    set current_occupants = greatest(0, current_occupants - 1),
        status = case
          when status = 'maintenance' then 'maintenance'
          when greatest(0, current_occupants - 1) >= capacity then 'occupied'
          else 'available'
        end
    where id = old_room.id;

    update public.rooms
    set current_occupants = current_occupants + 1,
        status = case
          when new_room.status = 'maintenance' then 'maintenance'
          when current_occupants + 1 >= capacity then 'occupied'
          else 'available'
        end
    where id = new_room.id;
  end if;

  if p_room_changed or can_sync_rent then
    update public.payments
    set room_number = case when p_room_changed then new_room.number else room_number end,
        amount = case when can_sync_rent then p_new_rent_amount::integer else amount end
    where tenant_id = p_tenant_id
      and month = p_current_month
      and status in ('pending', 'overdue');
  end if;
end
$$;

create or replace function public.swap_tenants_transaction(
  p_tenant_a_id text,
  p_tenant_b_id text,
  p_a_room_id text,
  p_a_room_number text,
  p_a_rent_amount numeric,
  p_b_room_id text,
  p_b_room_number text,
  p_b_rent_amount numeric,
  p_current_month text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  tenant_a public.tenants%rowtype;
  tenant_b public.tenants%rowtype;
begin
  if p_tenant_a_id = p_tenant_b_id then
    raise exception 'Two different tenants are required for a swap';
  end if;

  perform 1 from public.tenants
  where id in (p_tenant_a_id, p_tenant_b_id)
  order by id for update;

  select * into tenant_a from public.tenants where id = p_tenant_a_id;
  select * into tenant_b from public.tenants where id = p_tenant_b_id;

  if tenant_a.id is null or tenant_b.id is null then
    raise exception 'One or both tenants do not exist or are not accessible';
  end if;
  if tenant_a.hostel_id is distinct from tenant_b.hostel_id then
    raise exception 'Tenants from different hostels cannot be swapped';
  end if;
  if p_a_room_id is distinct from tenant_b.room_id
     or p_b_room_id is distinct from tenant_a.room_id
     or p_a_room_number is distinct from tenant_b.room_number
     or p_b_room_number is distinct from tenant_a.room_number then
    raise exception 'Swap destination rooms do not match the selected tenants';
  end if;
  if exists (
    select 1 from public.rooms
    where id in (p_a_room_id, p_b_room_id)
      and is_archived
  ) then
    raise exception 'Tenants cannot be swapped into archived rooms';
  end if;
  if (select count(*) from public.payments where tenant_id = p_tenant_a_id and month = p_current_month) > 1
     or (select count(*) from public.payments where tenant_id = p_tenant_b_id and month = p_current_month) > 1 then
    raise exception 'Tenants with split invoices cannot be swapped';
  end if;

  update public.tenants
  set room_id = p_a_room_id,
      room_number = p_a_room_number,
      rent_amount = p_a_rent_amount::integer
  where id = p_tenant_a_id;

  update public.tenants
  set room_id = p_b_room_id,
      room_number = p_b_room_number,
      rent_amount = p_b_rent_amount::integer
  where id = p_tenant_b_id;

  update public.payments
  set room_number = p_a_room_number,
      amount = p_a_rent_amount::integer
  where tenant_id = p_tenant_a_id
    and month = p_current_month
    and status in ('pending', 'overdue');

  update public.payments
  set room_number = p_b_room_number,
      amount = p_b_rent_amount::integer
  where tenant_id = p_tenant_b_id
    and month = p_current_month
    and status in ('pending', 'overdue');
end
$$;

create or replace function public.checkout_tenant_transaction(
  p_tenant_id text,
  p_checkout_date text,
  p_room_id text,
  p_new_occupants integer,
  p_room_status text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  tenant_record public.tenants%rowtype;
begin
  select *
  into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant does not exist or is not accessible';
  end if;
  if not tenant_record.is_active then
    raise exception 'Tenant is already checked out';
  end if;
  if exists (
    select 1 from public.payments
    where tenant_id = p_tenant_id
      and status in ('pending', 'overdue')
  ) then
    raise exception 'Tenant still has unpaid bills';
  end if;

  perform 1 from public.rooms where id = tenant_record.room_id for update;

  update public.tenants
  set is_active = false,
      check_out_date = p_checkout_date::date
  where id = p_tenant_id;

  update public.rooms
  set current_occupants = greatest(0, current_occupants - 1),
      status = case
        when status = 'maintenance' then 'maintenance'
        when greatest(0, current_occupants - 1) >= capacity then 'occupied'
        else 'available'
      end
  where id = tenant_record.room_id;
end
$$;

create or replace function public.record_payment_transaction(
  p_payment_id text,
  p_actual_amount numeric,
  p_paid_date date,
  p_new_payment jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  payment_record public.payments%rowtype;
  remaining_amount integer;
begin
  select *
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment does not exist or is not accessible';
  end if;
  if payment_record.status not in ('pending', 'overdue') then
    raise exception 'Only pending or overdue bills can be paid';
  end if;
  if p_actual_amount <= 0 or p_actual_amount > payment_record.amount then
    raise exception 'Received amount must be greater than zero and no more than the bill amount';
  end if;

  remaining_amount := payment_record.amount - p_actual_amount::integer;

  if remaining_amount > 0 and p_new_payment is null then
    raise exception 'A remainder payment is required for partial payments';
  end if;
  if remaining_amount = 0 and p_new_payment is not null then
    raise exception 'A remainder payment is not allowed for a full payment';
  end if;

  update public.payments
  set status = 'paid',
      paid_date = p_paid_date,
      amount = p_actual_amount::integer
  where id = p_payment_id;

  if remaining_amount > 0 then
    insert into public.payments (
      id, hostel_id, tenant_id, tenant_name, room_number, amount, month,
      due_date, status, receipt_note, source, is_remainder
    ) values (
      p_new_payment->>'id',
      payment_record.hostel_id,
      payment_record.tenant_id,
      payment_record.tenant_name,
      payment_record.room_number,
      remaining_amount,
      payment_record.month,
      payment_record.due_date,
      case when payment_record.status = 'overdue' then 'overdue' else 'pending' end,
      'Partial payment remainder for ' || payment_record.month,
      'split',
      true
    );
  end if;
end
$$;

create or replace function public.adjust_staff_balance(
  p_staff_id text,
  p_delta numeric,
  p_reason text
)
returns numeric
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_balance numeric;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'Staff balance adjustment must be non-zero';
  end if;

  update public.staff
  set balance = balance + p_delta
  where id = p_staff_id
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'Staff member does not exist or is not accessible';
  end if;

  return new_balance;
end
$$;

create or replace function public.get_activity_logs_page(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 100
)
returns setof public.activity_logs
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select *
  from public.activity_logs
  where hostel_id = public.current_owner_hostel_id()
    and (
      p_before_created_at is null
      or (created_at, id) < (p_before_created_at, p_before_id)
    )
  order by created_at desc, id desc
  limit least(greatest(p_limit, 1), 200)
$$;
