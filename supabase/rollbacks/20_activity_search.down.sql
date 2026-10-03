-- Rollback for migrations/20_activity_search.sql
-- Removes the search function and its index. The search box then falls back to
-- filtering only the history lines already downloaded.

drop function if exists public.search_activity_logs(text, boolean, timestamptz, uuid, integer);
drop index if exists public.activity_logs_message_trgm;
