-- =========================================================================
-- ATOMIC TRANSACTION: UPDATE TENANT
-- =========================================================================
-- This Stored Procedure ensures that updating a tenant profile, changing
-- their room occupancy, and syncing their monthly bills happens as a single
-- atomic transaction, preventing data drift.

CREATE OR REPLACE FUNCTION update_tenant_transaction(
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
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Update the tenant profile
  UPDATE tenants 
  SET 
    name = CASE WHEN p_tenant_updates ? 'name' THEN p_tenant_updates->>'name' ELSE name END,
    phone = CASE WHEN p_tenant_updates ? 'phone' THEN p_tenant_updates->>'phone' ELSE phone END,
    email = CASE WHEN p_tenant_updates ? 'email' THEN p_tenant_updates->>'email' ELSE email END,
    college = CASE WHEN p_tenant_updates ? 'college' THEN p_tenant_updates->>'college' ELSE college END,
    year = CASE WHEN p_tenant_updates ? 'year' THEN p_tenant_updates->>'year' ELSE year END,
    parent_name = CASE WHEN p_tenant_updates ? 'parent_name' THEN p_tenant_updates->>'parent_name' ELSE parent_name END,
    parent_phone = CASE WHEN p_tenant_updates ? 'parent_phone' THEN p_tenant_updates->>'parent_phone' ELSE parent_phone END,
    id_proof = CASE WHEN p_tenant_updates ? 'id_proof' THEN p_tenant_updates->>'id_proof' ELSE id_proof END,
    id_number = CASE WHEN p_tenant_updates ? 'id_number' THEN p_tenant_updates->>'id_number' ELSE id_number END,
    room_id = CASE WHEN p_tenant_updates ? 'room_id' THEN p_tenant_updates->>'room_id' ELSE room_id END,
    room_number = CASE WHEN p_tenant_updates ? 'room_number' THEN p_tenant_updates->>'room_number' ELSE room_number END,
    rent_amount = CASE WHEN p_tenant_updates ? 'rent_amount' THEN (p_tenant_updates->>'rent_amount')::integer ELSE rent_amount END,
    security_deposit = CASE WHEN p_tenant_updates ? 'security_deposit' THEN (p_tenant_updates->>'security_deposit')::integer ELSE security_deposit END,
    check_in_date = CASE WHEN p_tenant_updates ? 'check_in_date' THEN (p_tenant_updates->>'check_in_date')::date ELSE check_in_date END
  WHERE id = p_tenant_id;

  -- 2. Update room occupancies if room changed
  IF p_room_changed THEN
    UPDATE rooms 
    SET current_occupants = p_old_room_occupants, status = p_old_room_status 
    WHERE id = p_old_room_id;
    
    UPDATE rooms 
    SET current_occupants = p_new_room_occupants, status = p_new_room_status 
    WHERE id = p_new_room_id;
  END IF;

  -- 3. Sync pending/overdue payments if room or rent changed
  IF p_room_changed OR p_rent_changed THEN
    UPDATE payments
    SET 
      room_number = CASE WHEN p_room_changed THEN p_new_room_number ELSE room_number END,
      amount = CASE
        WHEN p_rent_changed AND (
          SELECT count(*) <= 1
          FROM payments bill_count
          WHERE bill_count.tenant_id = p_tenant_id
            AND bill_count.month = p_current_month
        ) THEN p_new_rent_amount
        ELSE amount
      END
    WHERE tenant_id = p_tenant_id 
      AND month = p_current_month 
      AND status IN ('pending', 'overdue');
  END IF;
END;
$$;
