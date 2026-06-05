-- =========================================================================
-- ATOMIC TRANSACTIONS (ELIMINATING DATA DRIFT)
-- =========================================================================

-- 1. UPDATE ROOM TRANSACTION
CREATE OR REPLACE FUNCTION update_room_transaction(
  p_room_id text,
  p_updates jsonb,
  p_rename boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  old_room_number text;
  room_hostel_id text;
BEGIN
  SELECT number, hostel_id
  INTO old_room_number, room_hostel_id
  FROM rooms
  WHERE id = p_room_id
  FOR UPDATE;

  -- Update the room (only overwrite fields if they exist in the JSON payload)
  UPDATE rooms 
  SET 
    number = CASE WHEN p_updates ? 'number' THEN p_updates->>'number' ELSE number END,
    capacity = CASE WHEN p_updates ? 'capacity' THEN (p_updates->>'capacity')::int ELSE capacity END,
    price = CASE WHEN p_updates ? 'price' THEN (p_updates->>'price')::numeric ELSE price END,
    type = CASE WHEN p_updates ? 'type' THEN p_updates->>'type' ELSE type END,
    floor = CASE WHEN p_updates ? 'floor' THEN (p_updates->>'floor')::int ELSE floor END,
    has_ac = CASE WHEN p_updates ? 'has_ac' THEN (p_updates->>'has_ac')::boolean ELSE has_ac END,
    has_attached_bath = CASE WHEN p_updates ? 'has_attached_bath' THEN (p_updates->>'has_attached_bath')::boolean ELSE has_attached_bath END,
    amenities = CASE WHEN p_updates ? 'amenities' THEN p_updates->'amenities' ELSE amenities END,
    status = CASE WHEN p_updates ? 'status' THEN p_updates->>'status' ELSE status END,
    maintenance_notes = CASE WHEN p_updates ? 'maintenance_notes' THEN p_updates->>'maintenance_notes' ELSE maintenance_notes END,
    current_occupants = CASE WHEN p_updates ? 'current_occupants' THEN (p_updates->>'current_occupants')::int ELSE current_occupants END
  WHERE id = p_room_id;

  -- If renaming, cascade the name change to ALL tenants and ALL payments
  IF p_rename THEN
    UPDATE tenants
    SET room_number = p_updates->>'number'
    WHERE room_id = p_room_id;
    
    UPDATE payments
    SET room_number = p_updates->>'number'
    WHERE hostel_id = room_hostel_id
      AND room_number = old_room_number;
  END IF;
END;
$$;

-- 2. SWAP TENANTS TRANSACTION
CREATE OR REPLACE FUNCTION swap_tenants_transaction(
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
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Swap Tenants
  UPDATE tenants 
  SET room_id = p_a_room_id, room_number = p_a_room_number, rent_amount = p_a_rent_amount 
  WHERE id = p_tenant_a_id;
  
  UPDATE tenants 
  SET room_id = p_b_room_id, room_number = p_b_room_number, rent_amount = p_b_rent_amount 
  WHERE id = p_tenant_b_id;

  -- Swap pending/overdue payments for current month
  UPDATE payments
  SET room_number = p_a_room_number, amount = p_a_rent_amount 
  WHERE tenant_id = p_tenant_a_id AND month = p_current_month AND status IN ('pending', 'overdue');
  
  UPDATE payments 
  SET room_number = p_b_room_number, amount = p_b_rent_amount 
  WHERE tenant_id = p_tenant_b_id AND month = p_current_month AND status IN ('pending', 'overdue');
END;
$$;

-- 3. CHECKOUT TENANT TRANSACTION
CREATE OR REPLACE FUNCTION checkout_tenant_transaction(
  p_tenant_id text,
  p_checkout_date text,
  p_room_id text,
  p_new_occupants int,
  p_room_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Checkout Tenant
  UPDATE tenants 
  SET is_active = false, check_out_date = p_checkout_date::date
  WHERE id = p_tenant_id;

  -- 2. Update Room Occupancy
  IF p_room_id IS NOT NULL THEN
    UPDATE rooms 
    SET current_occupants = p_new_occupants, status = p_room_status 
    WHERE id = p_room_id;
  END IF;
END;
$$;

-- 4. RECORD PAYMENT TRANSACTION
CREATE OR REPLACE FUNCTION record_payment_transaction(
  p_payment_id text,
  p_actual_amount numeric,
  p_paid_date date,
  p_new_payment jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Update the original payment
  UPDATE payments 
  SET status = 'paid', paid_date = p_paid_date, amount = p_actual_amount
  WHERE id = p_payment_id;

  -- 2. If it's a partial payment, insert the remainder bill
  IF p_new_payment IS NOT NULL THEN
    INSERT INTO payments (id, hostel_id, tenant_id, tenant_name, room_number, amount, month, due_date, status)
    VALUES (
      p_new_payment->>'id',
      p_new_payment->>'hostel_id',
      p_new_payment->>'tenant_id',
      p_new_payment->>'tenant_name',
      p_new_payment->>'room_number',
      (p_new_payment->>'amount')::numeric,
      p_new_payment->>'month',
      (p_new_payment->>'due_date')::date,
      p_new_payment->>'status'
    );
  END IF;
END;
$$;
