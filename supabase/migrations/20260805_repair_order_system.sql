-- NW Star Diagnostics repair-order system
-- Run this migration in Supabase SQL Editor after supabase/schema.sql.

create extension if not exists pgcrypto;

create sequence if not exists public.repair_order_number_seq start 1001;
create sequence if not exists public.invoice_number_seq start 1001;

do $$ begin
  create type public.repair_order_status as enum (
    'draft','awaiting_authorization','authorized','in_progress','waiting_parts',
    'completed','invoiced','paid','closed','cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.job_authorization_status as enum (
    'pending','approved','deferred','declined','completed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ro_item_type as enum ('labor','part','fee','sublet','discount');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.estimate_status as enum (
    'draft','sent','partially_approved','approved','declined','expired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invoice_status as enum ('draft','open','partially_paid','paid','void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending','succeeded','failed','refunded','void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash','card','check','zelle','ach','bank_transfer','financing','other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  ro_number text not null unique default (
    'RO-' || lpad(nextval('public.repair_order_number_seq')::text, 6, '0')
  ),
  service_request_id uuid unique references public.service_requests(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.repair_order_status not null default 'draft',
  original_complaint text not null,
  customer_instructions text,
  estimate_choice text not null default 'written_estimate'
    check (estimate_choice in ('written_estimate','authorized_limit','estimate_waived')),
  authorized_limit numeric(12,2),
  estimate_authorization_note text,
  parts_return_requested boolean not null default false,
  odometer_in integer,
  odometer_out integer,
  license_plate_snapshot text,
  vin_last8 text,
  opened_at timestamptz not null default now(),
  promised_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  tax_rate numeric(7,6) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  shop_supplies_amount numeric(12,2) not null default 0,
  shop_supplies_taxable boolean not null default true,
  discount_amount numeric(12,2) not null default 0,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ro_jobs (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  line_number integer not null,
  title text not null,
  customer_concern text not null,
  technician_findings text,
  recommended_action text,
  correction_performed text,
  authorization_status public.job_authorization_status not null default 'pending',
  authorized_amount numeric(12,2),
  authorization_method text,
  authorized_by_name text,
  authorized_by_phone text,
  authorized_at timestamptz,
  deferred_reason text,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repair_order_id, line_number)
);

create table if not exists public.ro_items (
  id uuid primary key default gen_random_uuid(),
  ro_job_id uuid not null references public.ro_jobs(id) on delete cascade,
  item_type public.ro_item_type not null,
  description text not null,
  part_number text,
  part_condition text check (
    part_condition is null or part_condition in ('new_oem','new_aftermarket','rebuilt','used','customer_supplied')
  ),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_cost numeric(12,2),
  unit_price numeric(12,2) not null default 0,
  taxable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  estimate_number text not null unique,
  version integer not null,
  status public.estimate_status not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  taxable_subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  customer_note text,
  sent_at timestamptz,
  authorized_at timestamptz,
  authorization_method text,
  authorized_by_name text,
  authorization_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repair_order_id, version)
);

create table if not exists public.estimate_jobs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  ro_job_id uuid references public.ro_jobs(id) on delete set null,
  line_number integer not null,
  title text not null,
  description text,
  amount numeric(12,2) not null default 0,
  taxable_amount numeric(12,2) not null default 0,
  decision public.job_authorization_status not null default 'pending',
  decision_at timestamptz,
  decision_by_name text,
  created_at timestamptz not null default now(),
  unique (estimate_id, line_number)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null unique references public.repair_orders(id) on delete restrict,
  invoice_number text not null unique default (
    'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
  ),
  status public.invoice_status not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  taxable_subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  issued_at timestamptz,
  due_at timestamptz,
  payment_provider text,
  hosted_payment_url text,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'succeeded',
  provider text,
  provider_reference text,
  notes text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ro_authorizations (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  ro_job_id uuid references public.ro_jobs(id) on delete set null,
  decision public.job_authorization_status not null,
  authorized_amount numeric(12,2),
  authorization_method text not null,
  authorized_by_name text not null,
  authorized_by_phone text,
  employee_name text,
  notes text,
  authorized_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists repair_orders_customer_id_idx on public.repair_orders(customer_id);
create index if not exists repair_orders_vehicle_id_idx on public.repair_orders(vehicle_id);
create index if not exists repair_orders_status_idx on public.repair_orders(status);
create index if not exists ro_jobs_repair_order_id_idx on public.ro_jobs(repair_order_id);
create index if not exists ro_jobs_authorization_status_idx on public.ro_jobs(authorization_status);
create index if not exists ro_items_ro_job_id_idx on public.ro_items(ro_job_id);
create index if not exists estimates_repair_order_id_idx on public.estimates(repair_order_id);
create index if not exists estimate_jobs_estimate_id_idx on public.estimate_jobs(estimate_id);
create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists ro_authorizations_repair_order_id_idx on public.ro_authorizations(repair_order_id);

create or replace function public.ro_item_extended_amount(
  p_item_type public.ro_item_type,
  p_quantity numeric,
  p_unit_price numeric
) returns numeric
language sql
immutable
as $$
  select case
    when p_item_type = 'discount' then -abs(coalesce(p_quantity, 0) * coalesce(p_unit_price, 0))
    else coalesce(p_quantity, 0) * coalesce(p_unit_price, 0)
  end;
$$;

create or replace view public.ro_job_totals as
select
  j.id as ro_job_id,
  j.repair_order_id,
  coalesce(sum(public.ro_item_extended_amount(i.item_type, i.quantity, i.unit_price)), 0)::numeric(12,2) as subtotal,
  coalesce(sum(
    case when i.taxable then public.ro_item_extended_amount(i.item_type, i.quantity, i.unit_price) else 0 end
  ), 0)::numeric(12,2) as taxable_subtotal
from public.ro_jobs j
left join public.ro_items i on i.ro_job_id = j.id
group by j.id, j.repair_order_id;

create or replace view public.repair_order_financials as
select
  ro.id as repair_order_id,
  coalesce(sum(jt.subtotal), 0)::numeric(12,2) as full_estimate_subtotal,
  coalesce(sum(jt.taxable_subtotal), 0)::numeric(12,2) as full_estimate_taxable,
  (
    coalesce(sum(jt.subtotal), 0)
    + ro.shop_supplies_amount
    - ro.discount_amount
  )::numeric(12,2) as full_estimate_before_tax,
  (
    coalesce(sum(case when j.authorization_status in ('approved','completed') then jt.subtotal else 0 end), 0)
    + ro.shop_supplies_amount
    - ro.discount_amount
  )::numeric(12,2) as approved_subtotal,
  (
    coalesce(sum(case when j.authorization_status in ('approved','completed') then jt.taxable_subtotal else 0 end), 0)
    + case when ro.shop_supplies_taxable then ro.shop_supplies_amount else 0 end
  )::numeric(12,2) as approved_taxable_subtotal
from public.repair_orders ro
left join public.ro_jobs j on j.repair_order_id = ro.id
left join public.ro_job_totals jt on jt.ro_job_id = j.id
group by ro.id, ro.shop_supplies_amount, ro.shop_supplies_taxable, ro.discount_amount;

create or replace function public.create_repair_order_from_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.service_requests%rowtype;
  vehicle_row public.vehicles%rowtype;
  ro_id uuid;
begin
  if not public.is_owner() then
    raise exception 'owner access required';
  end if;

  select id into ro_id
  from public.repair_orders
  where service_request_id = p_request_id;

  if ro_id is not null then
    return ro_id;
  end if;

  select * into request_row
  from public.service_requests
  where id = p_request_id;

  if request_row.id is null then
    raise exception 'service request not found';
  end if;

  select * into vehicle_row
  from public.vehicles
  where id = request_row.vehicle_id;

  insert into public.repair_orders(
    service_request_id,
    customer_id,
    vehicle_id,
    status,
    original_complaint,
    odometer_in,
    license_plate_snapshot,
    vin_last8,
    created_by
  ) values (
    request_row.id,
    request_row.customer_id,
    request_row.vehicle_id,
    'draft',
    request_row.complaint,
    vehicle_row.mileage,
    vehicle_row.license_plate,
    case when vehicle_row.vin is not null then right(vehicle_row.vin, 8) else null end,
    auth.uid()
  ) returning id into ro_id;

  insert into public.ro_jobs(
    repair_order_id,
    line_number,
    title,
    customer_concern,
    sort_order
  ) values (
    ro_id,
    1,
    'Initial diagnostic evaluation',
    request_row.complaint,
    1
  );

  return ro_id;
end;
$$;

create or replace function public.create_estimate_snapshot(p_repair_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  ro_row public.repair_orders%rowtype;
  next_version integer;
  estimate_id_value uuid;
  estimate_subtotal numeric(12,2);
  estimate_taxable numeric(12,2);
  estimate_tax numeric(12,2);
  estimate_total numeric(12,2);
begin
  if not public.is_owner() then
    raise exception 'owner access required';
  end if;

  select * into ro_row from public.repair_orders where id = p_repair_order_id;
  if ro_row.id is null then raise exception 'repair order not found'; end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.estimates where repair_order_id = p_repair_order_id;

  select
    (f.full_estimate_before_tax)::numeric(12,2),
    (f.full_estimate_taxable + case when ro_row.shop_supplies_taxable then 0 else 0 end)::numeric(12,2)
  into estimate_subtotal, estimate_taxable
  from public.repair_order_financials f
  where f.repair_order_id = p_repair_order_id;

  estimate_subtotal := coalesce(estimate_subtotal, 0);
  estimate_taxable := coalesce(estimate_taxable, 0)
    + case when ro_row.shop_supplies_taxable then ro_row.shop_supplies_amount else 0 end;
  estimate_tax := round(estimate_taxable * ro_row.tax_rate, 2);
  estimate_total := estimate_subtotal + estimate_tax;

  insert into public.estimates(
    repair_order_id, estimate_number, version, status,
    subtotal, taxable_subtotal, tax_amount, total
  ) values (
    p_repair_order_id,
    ro_row.ro_number || '-EST-' || next_version,
    next_version,
    'draft',
    estimate_subtotal,
    estimate_taxable,
    estimate_tax,
    estimate_total
  ) returning id into estimate_id_value;

  insert into public.estimate_jobs(
    estimate_id, ro_job_id, line_number, title, description,
    amount, taxable_amount, decision
  )
  select
    estimate_id_value,
    j.id,
    j.line_number,
    j.title,
    concat_ws(E'\n', nullif(j.customer_concern, ''), nullif(j.recommended_action, '')),
    coalesce(t.subtotal, 0),
    coalesce(t.taxable_subtotal, 0),
    j.authorization_status
  from public.ro_jobs j
  left join public.ro_job_totals t on t.ro_job_id = j.id
  where j.repair_order_id = p_repair_order_id
  order by j.line_number;

  update public.repair_orders
  set status = case when status = 'draft' then 'awaiting_authorization' else status end
  where id = p_repair_order_id;

  return estimate_id_value;
end;
$$;

create or replace function public.sync_repair_order_invoice(p_repair_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  ro_row public.repair_orders%rowtype;
  approved_subtotal_value numeric(12,2);
  approved_taxable_value numeric(12,2);
  tax_value numeric(12,2);
  total_value numeric(12,2);
  invoice_id_value uuid;
  paid_value numeric(12,2);
begin
  if not public.is_owner() then
    raise exception 'owner access required';
  end if;

  select * into ro_row from public.repair_orders where id = p_repair_order_id;
  if ro_row.id is null then raise exception 'repair order not found'; end if;

  select approved_subtotal, approved_taxable_subtotal
  into approved_subtotal_value, approved_taxable_value
  from public.repair_order_financials
  where repair_order_id = p_repair_order_id;

  approved_subtotal_value := coalesce(approved_subtotal_value, 0);
  approved_taxable_value := coalesce(approved_taxable_value, 0);
  tax_value := round(approved_taxable_value * ro_row.tax_rate, 2);
  total_value := approved_subtotal_value + tax_value;

  select id, amount_paid into invoice_id_value, paid_value
  from public.invoices where repair_order_id = p_repair_order_id;

  if invoice_id_value is null then
    insert into public.invoices(
      repair_order_id, status, subtotal, taxable_subtotal,
      tax_amount, total, amount_paid, balance_due, issued_at
    ) values (
      p_repair_order_id,
      'open',
      approved_subtotal_value,
      approved_taxable_value,
      tax_value,
      total_value,
      0,
      total_value,
      now()
    ) returning id into invoice_id_value;
  else
    update public.invoices
    set subtotal = approved_subtotal_value,
        taxable_subtotal = approved_taxable_value,
        tax_amount = tax_value,
        total = total_value,
        balance_due = greatest(total_value - coalesce(amount_paid, 0), 0),
        status = case
          when status = 'void' then 'void'::public.invoice_status
          when coalesce(amount_paid, 0) >= total_value and total_value > 0 then 'paid'::public.invoice_status
          when coalesce(amount_paid, 0) > 0 then 'partially_paid'::public.invoice_status
          else 'open'::public.invoice_status
        end,
        issued_at = coalesce(issued_at, now())
    where id = invoice_id_value;
  end if;

  update public.repair_orders
  set status = case
    when total_value > 0 then 'invoiced'::public.repair_order_status
    else status
  end
  where id = p_repair_order_id and status not in ('paid','closed','cancelled');

  return invoice_id_value;
end;
$$;

create or replace function public.refresh_invoice_payment_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice_id uuid;
  paid_value numeric(12,2);
  total_value numeric(12,2);
  ro_id uuid;
begin
  target_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(
    case
      when status = 'succeeded' then amount
      when status = 'refunded' then -amount
      else 0
    end
  ), 0)
  into paid_value
  from public.payments
  where invoice_id = target_invoice_id;

  select total, repair_order_id into total_value, ro_id
  from public.invoices where id = target_invoice_id;

  update public.invoices
  set amount_paid = paid_value,
      balance_due = greatest(total_value - paid_value, 0),
      status = case
        when status = 'void' then 'void'::public.invoice_status
        when paid_value >= total_value and total_value > 0 then 'paid'::public.invoice_status
        when paid_value > 0 then 'partially_paid'::public.invoice_status
        else 'open'::public.invoice_status
      end
  where id = target_invoice_id;

  if paid_value >= total_value and total_value > 0 then
    update public.repair_orders
    set status = 'paid'
    where id = ro_id and status not in ('closed','cancelled');
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_refresh_invoice_totals on public.payments;
create trigger payments_refresh_invoice_totals
after insert or update or delete on public.payments
for each row execute function public.refresh_invoice_payment_totals();

-- Reuse the existing timestamp trigger function from the base schema.
drop trigger if exists repair_orders_set_updated_at on public.repair_orders;
create trigger repair_orders_set_updated_at
before update on public.repair_orders
for each row execute function public.set_updated_at();

drop trigger if exists ro_jobs_set_updated_at on public.ro_jobs;
create trigger ro_jobs_set_updated_at
before update on public.ro_jobs
for each row execute function public.set_updated_at();

drop trigger if exists ro_items_set_updated_at on public.ro_items;
create trigger ro_items_set_updated_at
before update on public.ro_items
for each row execute function public.set_updated_at();

drop trigger if exists estimates_set_updated_at on public.estimates;
create trigger estimates_set_updated_at
before update on public.estimates
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

alter table public.repair_orders enable row level security;
alter table public.ro_jobs enable row level security;
alter table public.ro_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.ro_authorizations enable row level security;

revoke all on public.repair_orders, public.ro_jobs, public.ro_items,
  public.estimates, public.estimate_jobs, public.invoices,
  public.payments, public.ro_authorizations from anon;

do $$
declare
  table_name_value text;
  policy_name_value text;
begin
  foreach table_name_value in array array[
    'repair_orders','ro_jobs','ro_items','estimates','estimate_jobs',
    'invoices','payments','ro_authorizations'
  ]
  loop
    policy_name_value := 'owner_' || table_name_value || '_all';
    execute format('drop policy if exists %I on public.%I', policy_name_value, table_name_value);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      policy_name_value,
      table_name_value
    );
  end loop;
end $$;

grant select, insert, update, delete on public.repair_orders to authenticated;
grant select, insert, update, delete on public.ro_jobs to authenticated;
grant select, insert, update, delete on public.ro_items to authenticated;
grant select, insert, update, delete on public.estimates to authenticated;
grant select, insert, update, delete on public.estimate_jobs to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.ro_authorizations to authenticated;
grant select on public.ro_job_totals, public.repair_order_financials to authenticated;
grant usage, select on sequence public.repair_order_number_seq to authenticated;
grant usage, select on sequence public.invoice_number_seq to authenticated;

revoke all on function public.create_repair_order_from_request(uuid) from public;
revoke all on function public.create_estimate_snapshot(uuid) from public;
revoke all on function public.sync_repair_order_invoice(uuid) from public;
grant execute on function public.create_repair_order_from_request(uuid) to authenticated;
grant execute on function public.create_estimate_snapshot(uuid) to authenticated;
grant execute on function public.sync_repair_order_invoice(uuid) to authenticated;
