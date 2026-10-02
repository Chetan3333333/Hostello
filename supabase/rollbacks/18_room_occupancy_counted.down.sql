-- Rollback for migrations/18_room_occupancy_counted.sql
-- Removes the automatic counting and leaves the numbers as they are at that
-- moment, which are correct. From then on they are kept by hand again.

drop trigger if exists trigger_refresh_rooms_after_tenant_change on public.tenants;
drop trigger if exists trigger_sync_room_occupancy on public.rooms;
drop function if exists public.refresh_rooms_after_tenant_change();
drop function if exists public.sync_room_occupancy();
