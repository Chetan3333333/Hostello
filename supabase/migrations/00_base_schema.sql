-- Hostello base schema.
-- This migration makes a fresh Supabase project capable of running every
-- later migration in this directory in filename order.

create extension if not exists "uuid-ossp";

create table if not exists public.hostels (
  id text primary key,
  name text not null,
  type text,
  address text,
  phone text,
  whatsapp text,
  email text,
  description text,
  nearby_landmarks jsonb default '[]'::jsonb,
  rating numeric default 0,
  total_rooms integer default 0,
  amenities jsonb default '[]'::jsonb,
  rules text,
  pricing jsonb default '{}'::jsonb,
  established text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  hostel_id text not null references public.hostels(id),
  number text not null,
  floor integer not null default 1,
  type text not null,
  price integer not null default 0,
  status text not null default 'available',
  capacity integer not null,
  current_occupants integer not null default 0,
  amenities jsonb not null default '[]'::jsonb,
  has_attached_bath boolean not null default false,
  has_ac boolean not null default false,
  maintenance_notes text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id text primary key,
  hostel_id text not null references public.hostels(id),
  room_id text not null references public.rooms(id),
  room_number text not null,
  name text not null,
  phone text not null,
  email text,
  college text,
  year text,
  parent_name text,
  parent_phone text,
  id_proof text,
  id_number text,
  rent_amount integer not null default 0,
  security_deposit integer not null default 0,
  check_in_date date not null,
  check_out_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  hostel_id text not null references public.hostels(id),
  tenant_id text not null references public.tenants(id),
  tenant_name text not null,
  room_number text not null,
  amount integer not null,
  month text not null,
  due_date date not null,
  paid_date date,
  status text not null default 'pending',
  method text,
  receipt_note text,
  source text not null default 'manual',
  is_remainder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id text primary key,
  hostel_id text not null references public.hostels(id),
  name text not null,
  role text not null,
  phone text not null,
  salary integer not null default 0,
  join_date date not null,
  status text not null default 'present',
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  hostel_id text not null references public.hostels(id) on delete cascade,
  type text not null,
  message text not null,
  actor_user_id uuid,
  actor_type text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hostel_id text not null unique references public.hostels(id) on delete cascade,
  role text not null default 'owner',
  active_device_token text,
  created_at timestamptz not null default now()
);

create or replace function public.current_owner_hostel_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select hostel_id
  from public.owner_profiles
  where user_id = auth.uid()
    and role = 'owner'
  limit 1
$$;

revoke execute on function public.current_owner_hostel_id() from public, anon;
grant execute on function public.current_owner_hostel_id() to authenticated;
