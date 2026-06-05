-- =========================================================================
-- RLS LOCKDOWN FOR ACTIVITY_LOGS TABLE
-- =========================================================================
-- This makes the audit trail immutable and hostel-isolated.
-- Owners can ONLY read logs belonging to their own hostel.
-- Nobody can insert, update, or delete logs through the app.
-- Only the database triggers (which use security definer) can write logs.

-- Step 1: Enable RLS on the table
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any old policies if they exist (safety measure)
DROP POLICY IF EXISTS "Owners can read own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow app to insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow app to read logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Owners can manage their own hostel activity logs" ON public.activity_logs;

-- Step 3: Create the read-only policy
-- This ensures Hostel A can never see Hostel B's audit trail.
CREATE POLICY "Owners can read own activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (hostel_id = public.current_owner_hostel_id());

REVOKE ALL ON public.activity_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
