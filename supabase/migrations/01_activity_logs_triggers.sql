-- =========================================================================
-- 1. TRIGGER FOR ROOMS TABLE (Upgraded with Security Patch)
-- =========================================================================
CREATE OR REPLACE FUNCTION log_room_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO activity_logs (hostel_id, type, message, created_at)
    VALUES (NEW.hostel_id, 'system', 'System: Room ' || NEW.number || ' was added to the hostel.', NOW());
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Check for maintenance status changes
    IF (OLD.status != 'maintenance' AND NEW.status = 'maintenance') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'room', 'Room ' || NEW.number || ' marked under maintenance', NOW());
    ELSIF (OLD.status = 'maintenance' AND NEW.status = 'available') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'room', 'Room ' || NEW.number || ' is now available', NOW());
    END IF;

    -- 🚨 SECURITY PATCH: Check for secret Base Rent changes
    IF (OLD.price != NEW.price) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'room', 'WARNING: Room ' || NEW.number || ' base rent was secretly altered from ₹' || OLD.price || ' to ₹' || NEW.price || '.', NOW());
    END IF;
    
    -- 🚨 SECURITY PATCH: Check for secret Capacity changes
    IF (OLD.capacity != NEW.capacity) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'room', 'WARNING: Room ' || NEW.number || ' capacity was altered from ' || OLD.capacity || ' to ' || NEW.capacity || ' beds.', NOW());
    END IF;

    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO activity_logs (hostel_id, type, message, created_at)
    VALUES (OLD.hostel_id, 'system', 'WARNING: Room ' || OLD.number || ' was permanently DELETED.', NOW());
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_room_activity ON rooms;
CREATE TRIGGER trigger_room_activity
AFTER INSERT OR UPDATE OR DELETE ON rooms
FOR EACH ROW EXECUTE FUNCTION log_room_activity();

-- =========================================================================
-- 2. TRIGGER FOR TENANTS TABLE
-- =========================================================================
CREATE OR REPLACE FUNCTION log_tenant_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO activity_logs (hostel_id, type, message, created_at)
    VALUES (NEW.hostel_id, 'tenant', NEW.name || ' joined Room ' || NEW.room_number, NOW());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.room_number != NEW.room_number) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'tenant', NEW.name || ' moved from Room ' || OLD.room_number || ' to Room ' || NEW.room_number, NOW());
    END IF;
    IF (OLD.rent_amount != NEW.rent_amount) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'tenant', 'WARNING: ' || NEW.name || '''s monthly rent was secretly changed from ₹' || OLD.rent_amount || ' to ₹' || NEW.rent_amount || '.', NOW());
    END IF;
    IF (OLD.is_active = true AND NEW.is_active = false) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'tenant', NEW.name || ' checked out from Room ' || NEW.room_number, NOW());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO activity_logs (hostel_id, type, message, created_at)
    VALUES (OLD.hostel_id, 'system', 'WARNING: Tenant ' || OLD.name || ' was permanently DELETED.', NOW());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_activity ON tenants;
CREATE TRIGGER trigger_tenant_activity
AFTER INSERT OR UPDATE OR DELETE ON tenants
FOR EACH ROW EXECUTE FUNCTION log_tenant_activity();

-- =========================================================================
-- 3. TRIGGER FOR PAYMENTS TABLE
-- =========================================================================
CREATE OR REPLACE FUNCTION log_payment_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.status = 'pending') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'system', 'System generated rent bill of ₹' || NEW.amount || ' for ' || NEW.tenant_name || ' (' || NEW.month || ')', NOW());
    ELSE
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', 'WARNING: A manual payment record of ₹' || NEW.amount || ' was created for ' || NEW.tenant_name || '.', NOW());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status != 'written_off' AND NEW.status = 'written_off') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', '₹' || NEW.amount || ' written off for ' || NEW.tenant_name, NOW());
    END IF;
    IF (OLD.status = 'pending' AND NEW.status = 'pending' AND OLD.amount != NEW.amount) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', 'WARNING: Pending bill amount for ' || NEW.tenant_name || ' was altered from ₹' || OLD.amount || ' to ₹' || NEW.amount || '.', NOW());
    END IF;
    IF ((OLD.status = 'pending' OR OLD.status = 'overdue') AND NEW.status = 'paid') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', '₹' || NEW.amount || ' received from ' || NEW.tenant_name, NOW());
    END IF;
    IF (OLD.status = 'paid' AND (NEW.status = 'pending' OR NEW.status = 'overdue')) THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', 'WARNING: Payment of ₹' || NEW.amount || ' undone for ' || NEW.tenant_name, NOW());
    END IF;
    IF (OLD.status != 'overdue' AND NEW.status = 'overdue') THEN
      INSERT INTO activity_logs (hostel_id, type, message, created_at)
      VALUES (NEW.hostel_id, 'payment', 'WARNING: Rent overdue for ' || NEW.tenant_name || ', Room ' || NEW.room_number, NOW());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO activity_logs (hostel_id, type, message, created_at)
    VALUES (OLD.hostel_id, 'payment', 'WARNING: Payment record of ₹' || OLD.amount || ' for ' || OLD.tenant_name || ' was permanently DELETED.', NOW());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_activity ON payments;
CREATE TRIGGER trigger_payment_activity
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION log_payment_activity();

REVOKE EXECUTE ON FUNCTION log_room_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_tenant_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_payment_activity() FROM PUBLIC, anon, authenticated;
