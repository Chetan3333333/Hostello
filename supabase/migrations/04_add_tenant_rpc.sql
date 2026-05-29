-- =========================================================================
-- ATOMIC TRANSACTION: ADD TENANT
-- =========================================================================
-- This Stored Procedure ensures that creating a tenant, creating their 
-- first payment, and updating the room occupancy happens as a single 
-- "All or Nothing" transaction. This eliminates Data Drift from internet cutouts.

CREATE OR REPLACE FUNCTION add_tenant_transaction(
  p_tenant jsonb,
  p_payment jsonb,
  p_room_updates jsonb,
  p_room_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Insert the tenant profile
  INSERT INTO tenants
  SELECT * FROM jsonb_populate_record(null::tenants, p_tenant);

  -- 2. Insert the first month's pending payment
  INSERT INTO payments
  SELECT * FROM jsonb_populate_record(null::payments, p_payment);

  -- 3. Update the room occupancy and status
  UPDATE rooms 
  SET 
    current_occupants = (p_room_updates->>'current_occupants')::integer,
    status = p_room_updates->>'status'
  WHERE id = p_room_id;

END;
$$;
