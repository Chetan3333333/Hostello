-- 11: Remove the Staff feature from the database (Phase 2 of the staff removal).
--
-- The website stopped using staff data in commit b97cb0f (Phase 1). This
-- removes what is left in the database. It works on both shapes that exist:
--   * production, which had an undocumented redesign (staff_payments table,
--     generate_staff_salaries, log_staff_payment_activity, no staff.balance);
--   * a database built from these migration files (staff.balance and
--     adjust_staff_balance from migrations 00/08/09).
-- Every statement uses IF EXISTS, so it is safe to run more than once.
-- No CASCADE is used on purpose: if anything unexpected still depended on these
-- objects, this migration would stop with an error instead of silently
-- deleting it.
--
-- Kept on purpose: older activity_logs rows of type 'staff' and the check
-- constraint that allows that type, so past history stays readable.
--
-- Rollback: supabase/rollbacks/11_remove_staff.down.sql (recreates an EMPTY
-- staff table in the design these migration files describe).

-- 1. This function returns rows shaped like staff_payments, so it must be
--    removed before that table can be dropped.
drop function if exists public.generate_staff_salaries(text);

-- 2. The tables. Their triggers, access rules (policies), indexes and
--    constraints are removed together with them. staff_payments goes first
--    because it points at staff.
drop table if exists public.staff_payments;
drop table if exists public.staff;

-- 3. Functions that only served the removed tables.
drop function if exists public.log_staff_payment_activity();
drop function if exists public.log_staff_activity();
drop function if exists public.adjust_staff_balance(text, numeric, text);
