-- NW Star Diagnostics Supabase schema
-- Run this entire file in the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.request_status as enum (
    'new','contacted','scheduled','diagnosing','waiting','completed','paid','cancelled'
  );
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

-- Only explicitly approved Supabase Auth users may access owner records.
create table if not exists public.owner_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists customers_phone_idx on public.customers(phone);
create index if not exists customers_email_idx on public.customers(lower(email));
create index if not exists service_requests_status_idx on public.service_requests(status);
create index if not exists vehicles_customer_id_idx on public.vehicles(customer_id);
create index if not exists service_requests_customer_id_idx on public.service_requests(customer_id);
create index if not exists service_requests_vehicle_id_idx on public.service_requests(vehicle_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists service_requests_set_updated_at on public.service_requests;
create trigger service_requests_set_updated_at
before update on public.service_requests
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_files enable row level security;
alter table public.owner_users enable row level security;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.owner_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

drop policy if exists owner_customers_all on public.customers;
create policy owner_customers_all on public.customers
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists owner_vehicles_all on public.vehicles;
create policy owner_vehicles_all on public.vehicles
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists owner_service_requests_all on public.service_requests;
create policy owner_service_requests_all on public.service_requests
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists owner_request_files_all on public.request_files;
create policy owner_request_files_all on public.request_files
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.service_requests to authenticated;
grant select, insert, update, delete on public.request_files to authenticated;

-- Anonymous visitors receive no direct table access.
-- This security-definer function validates and inserts one complete intake record.
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
  customer_id_value uuid;
  vehicle_id_value uuid;
  request_id_value uuid;
  normalized_email text;
  normalized_vin text;
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

  normalized_email := nullif(lower(trim(p_email)), '');
  normalized_vin := nullif(upper(trim(p_vin)), '');

  if normalized_vin is not null and normalized_vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then
    raise exception 'invalid vin';
  end if;

  if p_urgency not in ('normal','vehicle-down','fleet-priority') then
    raise exception 'invalid urgency';
  end if;

  select id into customer_id_value
  from public.customers
  where phone = trim(p_phone)
     or (normalized_email is not null and lower(email) = normalized_email)
  order by created_at asc
  limit 1;

  if customer_id_value is null then
    insert into public.customers(full_name, phone, email, company_name)
    values (
      trim(p_full_name),
      trim(p_phone),
      normalized_email,
      nullif(trim(p_company_name), '')
    )
    returning id into customer_id_value;
  else
    update public.customers
    set full_name = trim(p_full_name),
        phone = trim(p_phone),
        email = coalesce(normalized_email, email),
        company_name = coalesce(nullif(trim(p_company_name), ''), company_name)
    where id = customer_id_value;
  end if;

  if normalized_vin is not null then
    select id into vehicle_id_value
    from public.vehicles
    where vin = normalized_vin
    limit 1;
  end if;

  if vehicle_id_value is null then
    insert into public.vehicles(
      customer_id, year, make, model, vin, mileage, unit_number
    )
    values (
      customer_id_value,
      p_year,
      trim(p_make),
      trim(p_model),
      normalized_vin,
      p_mileage,
      nullif(trim(p_unit_number), '')
    )
    returning id into vehicle_id_value;
  else
    update public.vehicles
    set customer_id = customer_id_value,
        year = coalesce(p_year, year),
        make = trim(p_make),
        model = trim(p_model),
        mileage = coalesce(p_mileage, mileage),
        unit_number = coalesce(nullif(trim(p_unit_number), ''), unit_number)
    where id = vehicle_id_value;
  end if;

  insert into public.service_requests(
    customer_id,
    vehicle_id,
    complaint,
    known_codes,
    prior_work,
    service_location,
    preferred_time,
    urgency
  )
  values (
    customer_id_value,
    vehicle_id_value,
    trim(p_complaint),
    nullif(trim(p_known_codes), ''),
    nullif(trim(p_prior_work), ''),
    trim(p_service_location),
    nullif(trim(p_preferred_time), ''),
    p_urgency
  )
  returning id into request_id_value;

  return 'NW-' || upper(substr(replace(request_id_value::text, '-', ''), 1, 8));
end;
$$;

revoke all on function public.submit_service_request(
  text,text,text,text,integer,text,text,text,integer,text,text,text,text,text,text,text
) from public;

grant execute on function public.submit_service_request(
  text,text,text,text,integer,text,text,text,integer,text,text,text,text,text,text,text
) to anon, authenticated;

-- After creating the owner in Supabase Authentication, run owner-setup.sql.
-- Never expose a secret or service-role key in browser code.
