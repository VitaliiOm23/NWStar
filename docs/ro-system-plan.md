# Repair order system

The repair-order system tracks the full path from the original customer complaint to the final payment.

## Included workflow

1. Convert a public service request into a repair order.
2. Preserve the original customer complaint.
3. Add a separate RO job line for every distinct diagnostic or repair operation.
4. Record concern, findings/cause, recommendation, and correction on each job line.
5. Add labor, parts, fees, sublet work, and discounts to each job.
6. Record each customer decision as pending, approved, deferred, declined, or completed.
7. Store authorization method, customer/designee name, phone, authorized amount, date, and notes.
8. Create versioned estimate snapshots.
9. Create an invoice from approved/completed work only.
10. Record cash, card, check, Zelle, ACH, bank transfer, financing, and other payments.
11. Track invoice total, amount paid, and balance due.
12. Store an optional Stripe, Square, Chase, or other hosted payment URL.
13. Print a complete RO/invoice showing complaint, jobs, parts, labor, decisions, and balance.

## Supabase setup

The base schema must already be installed. Then run this complete migration in Supabase SQL Editor:

`supabase/migrations/20260805_repair_order_system.sql`

The migration is designed to preserve the existing customer, vehicle, service-request, and owner-login data.

## First use

1. Open `/admin`.
2. Select an incoming service request.
3. Click **Create repair order**.
4. Add or edit job lines.
5. Add labor, parts, fees, and discounts.
6. Record customer decisions and authorization details.
7. Create an estimate snapshot.
8. Approve or defer each job line.
9. Create or refresh the invoice from approved work.
10. Record payments until the balance is zero.

## Payment processing

The first release includes the complete invoice and payment ledger plus a hosted-payment URL field. Card information is never stored in Supabase. Actual card entry should remain on a PCI-compliant hosted page such as Stripe Checkout, Stripe Hosted Invoice Page, Square Invoice, or another processor selected by the business.
