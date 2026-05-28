-- =========================================================================
-- DATABASE INDEXES FOR PERFORMANCE SCALABILITY
-- =========================================================================

-- These indexes drastically speed up queries that filter by hostel_id.
-- Without these, PostgreSQL will perform a "Sequential Scan" (reading the whole table).
-- With these, PostgreSQL performs an "Index Scan" (reading only the relevant rows).

CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_tenants_hostel_id ON public.tenants(hostel_id);
CREATE INDEX IF NOT EXISTS idx_payments_hostel_id ON public.payments(hostel_id);
CREATE INDEX IF NOT EXISTS idx_staff_hostel_id ON public.staff(hostel_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_hostel_id ON public.activity_logs(hostel_id);

-- Extra Optimization: Index for payments by tenant (used heavily when checking a specific tenant's history)
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
