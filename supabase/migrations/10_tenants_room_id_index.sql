-- 10: Index tenants by room.
-- Speeds up room-based tenant lookups (check-outs, room transfers, swaps and
-- occupancy checks all filter tenants by room_id).
--
-- Production already has this index: it was created by hand in the SQL Editor
-- and never committed. This migration records it so a database rebuilt from
-- these files matches production. Safe to run more than once.
-- Rollback: supabase/rollbacks/10_tenants_room_id_index.down.sql

create index if not exists idx_tenants_room_id on public.tenants (room_id);
