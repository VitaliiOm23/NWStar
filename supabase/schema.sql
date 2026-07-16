-- NW Star Diagnostics initial Supabase schema
-- Run in the Supabase SQL editor after reviewing the fields.

create extension if not exists pgcrypto;

create type public.request_status as enum (
  'new',
  'contacted',
  'scheduled',
  'diagnosing',
  'waiting',
  'completed',
  'paid',
  'cancelled'
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  company_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  year integer,
  make text not null,
  model text not null,
  vin text unique,
  mileage integer,
  license_plate text,
  unit_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.request_status not null default 'new',
  complaint text not null,
  known_codes text,
  prior_work text,
  service_location text not null,
  preferred_time text,
  urgency text,
  internal_notes text,
  diagnostic_findings text,
  recommendation text,
  quoted_amount numeric(10,2),
  final_amount numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index service_requests_status_idx on public.service_requests(status);
create index vehicles_customer_id_idx on public.vehicles(customer_id);
create index service_requests_customer_id_idx on public.service_requests(customer_id);
create index service_requests_vehicle_id_idx on public.service_requests(vehicle_id);

alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_files enable row level security;

-- Owner access policies will be added after the owner's Supabase user ID is known.
-- Public form submissions should go through a validated server action using the service role key.
-- Never expose the service role key in browser code.
