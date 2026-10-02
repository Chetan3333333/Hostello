-- 20: Searching the activity history looks at the whole history (fix for the
-- owner's report).
--
-- Before: the app downloaded the latest 100 history lines at login and the
-- search box filtered only those. On this database that meant searching a
-- tenant's name found 11 lines out of 22, and "warnings only" showed 36 out of
-- 230, with no sign that anything was missing.
--
-- After: searching asks the database, across the hostel's entire history, with
-- the same paging style as the normal feed. Row-level security still applies,
-- because the function runs as the caller, so an owner can only ever search
-- their own hostel.
--
-- Safe to run more than once.
-- Rollback: supabase/rollbacks/20_activity_search.down.sql

-- A text-search index, so this stays fast as the history grows.
create extension if not exists pg_trgm with schema extensions;

create index if not exists activity_logs_message_trgm
  on public.activity_logs using gin (message extensions.gin_trgm_ops);

create or replace function public.search_activity_logs(
  p_search text default null,
  p_warnings_only boolean default false,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 100
)
returns setof public.activity_logs
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select *
  from public.activity_logs
  where hostel_id = public.current_owner_hostel_id()
    and (
      p_search is null
      or btrim(p_search) = ''
      or message ilike '%' || btrim(p_search) || '%'
    )
    and (not coalesce(p_warnings_only, false) or message like 'WARNING%')
    and (
      p_before_created_at is null
      or (created_at, id) < (p_before_created_at, p_before_id)
    )
  order by created_at desc, id desc
  limit least(greatest(p_limit, 1), 200)
$$;

revoke execute on function public.search_activity_logs(text, boolean, timestamptz, uuid, integer) from public, anon;
grant execute on function public.search_activity_logs(text, boolean, timestamptz, uuid, integer) to authenticated;
