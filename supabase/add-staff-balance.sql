-- Run this in your Supabase Dashboard -> SQL Editor
alter table public.staff
add column if not exists balance numeric not null default 0;
