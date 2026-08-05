-- Follow-up hardening for the repair-order migration.
-- Supabase CLI and GitHub migrations run this automatically after the base migration.

-- Owner-facing application code uses RPC functions for financial calculations.
-- Do not expose the underlying aggregate views directly to every authenticated user.
revoke all on public.ro_job_totals, public.repair_order_financials from authenticated, anon;

create or replace view public.repair_order_financials as
select
  ro.id as repair_order_id,
  coalesce(sum(jt.subtotal), 0)::numeric(12,2) as full_estimate_subtotal,
  greatest(
    coalesce(sum(jt.taxable_subtotal), 0)
    + case when ro.shop_supplies_taxable then ro.shop_supplies_amount else 0 end
    - ro.discount_amount,
    0
  )::numeric(12,2) as full_estimate_taxable,
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
  greatest(
    coalesce(sum(case when j.authorization_status in ('approved','completed') then jt.taxable_subtotal else 0 end), 0)
    + case when ro.shop_supplies_taxable then ro.shop_supplies_amount else 0 end
    - ro.discount_amount,
    0
  )::numeric(12,2) as approved_taxable_subtotal
from public.repair_orders ro
left join public.ro_jobs j on j.repair_order_id = ro.id
left join public.ro_job_totals jt on jt.ro_job_id = j.id
group by ro.id, ro.shop_supplies_amount, ro.shop_supplies_taxable, ro.discount_amount;

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

  select * into ro_row
  from public.repair_orders
  where id = p_repair_order_id;

  if ro_row.id is null then
    raise exception 'repair order not found';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.estimates
  where repair_order_id = p_repair_order_id;

  select
    full_estimate_before_tax,
    full_estimate_taxable
  into estimate_subtotal, estimate_taxable
  from public.repair_order_financials
  where repair_order_id = p_repair_order_id;

  estimate_subtotal := coalesce(estimate_subtotal, 0);
  estimate_taxable := coalesce(estimate_taxable, 0);
  estimate_tax := round(estimate_taxable * ro_row.tax_rate, 2);
  estimate_total := estimate_subtotal + estimate_tax;

  insert into public.estimates(
    repair_order_id,
    estimate_number,
    version,
    status,
    subtotal,
    taxable_subtotal,
    tax_amount,
    total
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
    estimate_id,
    ro_job_id,
    line_number,
    title,
    description,
    amount,
    taxable_amount,
    decision
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
  set status = case
    when status = 'draft' then 'awaiting_authorization'::public.repair_order_status
    else status
  end
  where id = p_repair_order_id;

  return estimate_id_value;
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
  if tg_op = 'DELETE' then
    target_invoice_id := old.invoice_id;
  else
    target_invoice_id := new.invoice_id;
  end if;

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

  select total, repair_order_id
  into total_value, ro_id
  from public.invoices
  where id = target_invoice_id;

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

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
