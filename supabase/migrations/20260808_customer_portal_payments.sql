-- Secure customer-facing repair-order portal, line authorization, and payment audit support.
-- Customer links are bearer tokens: keep them unguessable and never expose owner-only tables directly.

create table if not exists public.customer_portal_links (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  expires_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_portal_links_ro_idx
  on public.customer_portal_links(repair_order_id, active, created_at desc);

create table if not exists public.customer_portal_events (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  portal_link_id uuid references public.customer_portal_links(id) on delete set null,
  ro_job_id uuid references public.ro_jobs(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  event_type text not null,
  actor_type text not null default 'customer',
  actor_name text,
  actor_contact text,
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_portal_events_ro_created_idx
  on public.customer_portal_events(repair_order_id, created_at desc);

create unique index if not exists payments_provider_reference_uidx
  on public.payments(provider, provider_reference)
  where provider_reference is not null;

alter table public.customer_portal_links enable row level security;
alter table public.customer_portal_events enable row level security;

grant select, insert, update, delete on public.customer_portal_links to authenticated;
grant select, insert, update, delete on public.customer_portal_events to authenticated;

create policy "Owner manages customer portal links"
on public.customer_portal_links
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "Owner manages customer portal events"
on public.customer_portal_events
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create or replace function public.get_customer_portal(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_row public.customer_portal_links%rowtype;
  ro_row public.repair_orders%rowtype;
  customer_row public.customers%rowtype;
  vehicle_row public.vehicles%rowtype;
  jobs_payload jsonb;
  estimate_payload jsonb;
  invoice_payload jsonb;
  payment_payload jsonb;
begin
  select * into link_row
  from public.customer_portal_links
  where token = p_token
    and active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if link_row.id is null then
    return null;
  end if;

  select * into ro_row
  from public.repair_orders
  where id = link_row.repair_order_id;

  if ro_row.id is null then
    return null;
  end if;

  select * into customer_row from public.customers where id = ro_row.customer_id;
  select * into vehicle_row from public.vehicles where id = ro_row.vehicle_id;

  if link_row.last_viewed_at is null or link_row.last_viewed_at < now() - interval '10 minutes' then
    update public.customer_portal_links
    set last_viewed_at = now()
    where id = link_row.id;

    insert into public.customer_portal_events(
      repair_order_id, portal_link_id, event_type, actor_type
    ) values (
      ro_row.id, link_row.id, 'portal_viewed', 'customer'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'line_number', j.line_number,
        'title', j.title,
        'customer_concern', j.customer_concern,
        'technician_findings', j.technician_findings,
        'recommended_action', j.recommended_action,
        'correction_performed', j.correction_performed,
        'authorization_status', j.authorization_status,
        'authorized_at', j.authorized_at,
        'deferred_reason', j.deferred_reason,
        'amount', coalesce((
          select sum(
            case when i.item_type = 'discount'
              then -abs(i.quantity * i.unit_price)
              else i.quantity * i.unit_price
            end
          )
          from public.ro_items i
          where i.ro_job_id = j.id
        ), 0),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'item_type', i.item_type,
              'description', i.description,
              'part_number', i.part_number,
              'part_condition', i.part_condition,
              'quantity', i.quantity,
              'unit_price', i.unit_price,
              'taxable', i.taxable,
              'extended', case when i.item_type = 'discount'
                then -abs(i.quantity * i.unit_price)
                else i.quantity * i.unit_price
              end
            ) order by i.sort_order, i.created_at
          )
          from public.ro_items i
          where i.ro_job_id = j.id
        ), '[]'::jsonb)
      ) order by j.line_number
    ),
    '[]'::jsonb
  ) into jobs_payload
  from public.ro_jobs j
  where j.repair_order_id = ro_row.id;

  select jsonb_build_object(
    'id', e.id,
    'estimate_number', e.estimate_number,
    'version', e.version,
    'status', e.status,
    'subtotal', e.subtotal,
    'tax_amount', e.tax_amount,
    'total', e.total,
    'valid_until', e.valid_until,
    'customer_note', e.customer_note,
    'sent_at', e.sent_at,
    'authorized_at', e.authorized_at,
    'created_at', e.created_at
  ) into estimate_payload
  from public.estimates e
  where e.repair_order_id = ro_row.id
  order by e.version desc
  limit 1;

  select jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'status', i.status,
    'subtotal', i.subtotal,
    'tax_amount', i.tax_amount,
    'total', i.total,
    'amount_paid', i.amount_paid,
    'balance_due', i.balance_due,
    'issued_at', i.issued_at,
    'due_at', i.due_at,
    'payment_provider', i.payment_provider,
    'hosted_payment_url', i.hosted_payment_url,
    'customer_note', i.customer_note
  ) into invoice_payload
  from public.invoices i
  where i.repair_order_id = ro_row.id
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'amount', p.amount,
      'method', p.method,
      'status', p.status,
      'provider', p.provider,
      'received_at', p.received_at
    ) order by p.received_at desc
  ), '[]'::jsonb) into payment_payload
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  where i.repair_order_id = ro_row.id
    and p.status = 'succeeded';

  return jsonb_build_object(
    'portal', jsonb_build_object(
      'token', link_row.token,
      'expires_at', link_row.expires_at,
      'created_at', link_row.created_at
    ),
    'repair_order', jsonb_build_object(
      'id', ro_row.id,
      'ro_number', ro_row.ro_number,
      'status', ro_row.status,
      'original_complaint', ro_row.original_complaint,
      'opened_at', ro_row.opened_at,
      'promised_at', ro_row.promised_at,
      'completed_at', ro_row.completed_at,
      'odometer_in', ro_row.odometer_in,
      'odometer_out', ro_row.odometer_out,
      'tax_rate', ro_row.tax_rate,
      'shop_supplies_amount', ro_row.shop_supplies_amount,
      'discount_amount', ro_row.discount_amount
    ),
    'customer', jsonb_build_object(
      'full_name', customer_row.full_name,
      'phone', customer_row.phone,
      'email', customer_row.email,
      'company_name', customer_row.company_name
    ),
    'vehicle', jsonb_build_object(
      'year', vehicle_row.year,
      'make', vehicle_row.make,
      'model', vehicle_row.model,
      'vin', vehicle_row.vin,
      'mileage', vehicle_row.mileage,
      'license_plate', vehicle_row.license_plate,
      'unit_number', vehicle_row.unit_number
    ),
    'jobs', jobs_payload,
    'estimate', estimate_payload,
    'invoice', invoice_payload,
    'payments', payment_payload
  );
end;
$$;

revoke all on function public.get_customer_portal(uuid) from public;
grant execute on function public.get_customer_portal(uuid) to anon, authenticated;

create or replace function public.decide_customer_job(
  p_token uuid,
  p_job_id uuid,
  p_decision text,
  p_name text,
  p_contact text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_row public.customer_portal_links%rowtype;
  job_row public.ro_jobs%rowtype;
  estimate_id_value uuid;
  job_amount numeric(12,2);
  pending_count integer;
  approved_count integer;
  declined_count integer;
  next_estimate_status public.estimate_status;
begin
  if p_decision not in ('approved', 'deferred') then
    raise exception 'invalid decision';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'name is required';
  end if;

  select * into link_row
  from public.customer_portal_links
  where token = p_token
    and active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if link_row.id is null then
    raise exception 'invalid or expired customer link';
  end if;

  select * into job_row
  from public.ro_jobs
  where id = p_job_id
    and repair_order_id = link_row.repair_order_id;

  if job_row.id is null then
    raise exception 'repair-order line not found';
  end if;

  if job_row.authorization_status = 'completed' then
    raise exception 'completed work cannot be changed';
  end if;

  select coalesce(sum(
    case when item_type = 'discount'
      then -abs(quantity * unit_price)
      else quantity * unit_price
    end
  ), 0)
  into job_amount
  from public.ro_items
  where ro_job_id = job_row.id;

  update public.ro_jobs
  set authorization_status = p_decision::public.job_authorization_status,
      authorized_amount = case when p_decision = 'approved' then job_amount else null end,
      authorization_method = 'customer_portal',
      authorized_by_name = trim(p_name),
      authorized_by_phone = nullif(trim(coalesce(p_contact, '')), ''),
      authorized_at = now(),
      deferred_reason = case when p_decision = 'deferred' then nullif(trim(coalesce(p_note, '')), '') else null end
  where id = job_row.id;

  insert into public.ro_authorizations(
    repair_order_id,
    ro_job_id,
    decision,
    authorized_amount,
    authorization_method,
    authorized_by_name,
    authorized_by_phone,
    employee_name,
    notes,
    authorized_at
  ) values (
    link_row.repair_order_id,
    job_row.id,
    p_decision::public.job_authorization_status,
    case when p_decision = 'approved' then job_amount else null end,
    'customer_portal',
    trim(p_name),
    nullif(trim(coalesce(p_contact, '')), ''),
    null,
    nullif(trim(coalesce(p_note, '')), ''),
    now()
  );

  select id into estimate_id_value
  from public.estimates
  where repair_order_id = link_row.repair_order_id
  order by version desc
  limit 1;

  if estimate_id_value is not null then
    update public.estimate_jobs
    set decision = p_decision::public.job_authorization_status,
        decision_at = now(),
        decision_by_name = trim(p_name)
    where estimate_id = estimate_id_value
      and ro_job_id = job_row.id;

    select
      count(*) filter (where decision = 'pending'),
      count(*) filter (where decision in ('approved', 'completed')),
      count(*) filter (where decision in ('deferred', 'declined'))
    into pending_count, approved_count, declined_count
    from public.estimate_jobs
    where estimate_id = estimate_id_value;

    next_estimate_status := case
      when pending_count = 0 and approved_count > 0 and declined_count = 0 then 'approved'::public.estimate_status
      when approved_count > 0 then 'partially_approved'::public.estimate_status
      when pending_count = 0 and declined_count > 0 then 'declined'::public.estimate_status
      else 'sent'::public.estimate_status
    end;

    update public.estimates
    set status = next_estimate_status,
        authorized_at = case when next_estimate_status in ('approved', 'partially_approved') then now() else authorized_at end,
        authorization_method = 'customer_portal',
        authorized_by_name = trim(p_name)
    where id = estimate_id_value;
  end if;

  update public.repair_orders
  set status = case
    when exists (
      select 1 from public.ro_jobs
      where repair_order_id = link_row.repair_order_id
        and authorization_status in ('approved', 'completed')
    ) then 'authorized'::public.repair_order_status
    else 'awaiting_authorization'::public.repair_order_status
  end
  where id = link_row.repair_order_id
    and status in ('draft', 'awaiting_authorization', 'authorized');

  insert into public.customer_portal_events(
    repair_order_id,
    portal_link_id,
    ro_job_id,
    estimate_id,
    event_type,
    actor_type,
    actor_name,
    actor_contact,
    channel,
    metadata
  ) values (
    link_row.repair_order_id,
    link_row.id,
    job_row.id,
    estimate_id_value,
    'job_' || p_decision,
    'customer',
    trim(p_name),
    nullif(trim(coalesce(p_contact, '')), ''),
    'web',
    jsonb_build_object('amount', job_amount, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return jsonb_build_object('ok', true, 'decision', p_decision, 'job_id', job_row.id, 'amount', job_amount);
end;
$$;

revoke all on function public.decide_customer_job(uuid, uuid, text, text, text, text) from public;
grant execute on function public.decide_customer_job(uuid, uuid, text, text, text, text) to anon, authenticated;
