-- NW Star Diagnostics Supabase schema
-- Run this entire file in the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.request_status as enum ('new','contacted','scheduled','diagnosing','waiting','completed','paid','cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  company_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
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

create table if not exists public.service_requests (
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

create table if not exists public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists service_requests_status_idx on public.service_requests(status);
create index if not exists vehicles_customer_id_idx on public.vehicles(customer_id);
create index if not exists service_requests_customer_id_idx on public.service_requests(customer_id);
create index if not exists service_requests_vehicle_id_idx on public.service_requests(vehicle_id);

alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_files enable row level security;

-- Anonymous visitors receive no direct table read, update or delete access.
-- This narrowly scoped function validates and inserts one complete intake record.
create or replace function public.submit_service_request(
  p_full_name text,
  p_phone text,
  p_email text,
  p_company_name text,
  p_year integer,
  p_make text,
  p_model text,
  p_vin text,
  p_mileage integer,
  p_unit_number text,
  p_complaint text,
  p_known_codes text,
  p_prior_work text,
  p_service_location text,
  p_preferred_time text,
  p_urgency text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_customer_id uuid;
  new_vehicle_id uuid;
  new_request_id uuid;
begin
  if char_length(trim(p_full_name)) < 2 or char_length(trim(p_phone)) < 7 then
    raise exception 'invalid contact information';
  end if;
  if char_length(trim(p_make)) < 2 or char_length(trim(p_model)) < 1 then
    raise exception 'invalid vehicle information';
  end if;
  if char_length(trim(p_complaint)) < 10 or char_length(trim(p_service_location)) < 2 then
    raise exception 'invalid complaint or location';
  end if;
  if p_vin is not null and p_vin <> '' and p_vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then
    raise exception 'invalid vin';
  end if;
  if p_urgency not in ('normal','vehicle-down','fleet-priority') then
    raise exception 'invalid urgency';
  end if;

  insert into public.customers(full_name, phone, email, company_name)
  values (trim(p_full_name), trim(p_phone), nullif(trim(p_email),''), nullif(trim(p_company_name),''))
  returning id into new_customer_id;

  insert into public.vehicles(customer_id, year, make, model, vin, mileage, unit_number)
  values (new_customer_id, p_year, trim(p_make), trim(p_model), nullif(upper(trim(p_vin)),''), p_mileage, nullif(trim(p_unit_number),''))
  returning id into new_vehicle_id;

  insert into public.service_requests(customer_id, vehicle_id, complaint, known_codes, prior_work, service_location, preferred_time, urgency)
  values (new_customer_id, new_vehicle_id, trim(p_complaint), nullif(trim(p_known_codes),''), nullif(trim(p_prior_work),''), trim(p_service_location), nullif(trim(p_preferred_time),''), p_urgency)
  returning id into new_request_id;

  return 'NW-' || upper(substr(replace(new_request_id::text, '-', ''), 1, 8));
end;
$$;

revoke all on function public.submit_service_request(text,text,text,text,integer,text,text,text,integer,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_service_request(text,text,text,text,integer,text,text,text,integer,text,text,text,text,text,text,text) to anon, authenticated;

-- Owner read/write policies are added in the authentication/dashboard phase.
-- Never expose a secret or service-role key in browser code.
