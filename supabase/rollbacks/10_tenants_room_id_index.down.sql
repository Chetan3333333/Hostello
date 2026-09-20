-- Rollback for migrations/10_tenants_room_id_index.sql
-- Removes the index only; no table data is touched. Safe to run more than once.

drop index if exists public.idx_tenants_room_id;
