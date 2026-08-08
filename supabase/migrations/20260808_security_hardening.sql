-- Tighten existing repair-order function privileges surfaced by the Supabase security advisor.
-- Public intake and token-gated customer portal functions remain intentionally callable by anon.

revoke execute on function public.create_estimate_snapshot(uuid) from public, anon;
grant execute on function public.create_estimate_snapshot(uuid) to authenticated;

revoke execute on function public.create_repair_order_from_request(uuid) from public, anon;
grant execute on function public.create_repair_order_from_request(uuid) to authenticated;

revoke execute on function public.sync_repair_order_invoice(uuid) from public, anon;
grant execute on function public.sync_repair_order_invoice(uuid) to authenticated;

revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

revoke execute on function public.refresh_invoice_payment_totals() from public, anon, authenticated;

alter function public.ro_item_extended_amount(public.ro_item_type, numeric, numeric)
  set search_path = public;
