# NW Star Diagnostics

Premium mobile automotive diagnostics website and private operations dashboard.

## Product direction

- Black/graphite motorsport-inspired visual system with green-teal accents
- Public marketing website for Mercedes-Benz, Sprinter, electrical and fleet diagnostics
- Secure owner-only dashboard
- Customer intake and vehicle/job data storage
- Supabase authentication, database and file storage
- Vercel deployment

## Current launch features

- Responsive public website and service-request intake
- Common vehicle concerns can open the request form with the complaint prefilled
- Server-side validation and rate limiting
- Supabase RPC intake that does not expose table access to anonymous visitors
- Owner email/password authentication
- Protected `/admin` dashboard
- Live customer, vehicle and request records
- Request pipeline counts and status updates
- Row-level database security through an explicit `owner_users` allowlist
- Repair orders, job lines, estimates, customer authorization, invoices and payment records

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add these values to `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key
- `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` locally

Never commit `.env.local`, a Supabase secret key, or a service-role key.

## Supabase owner login setup

1. Open Supabase **Authentication > Users**.
2. Create one owner user with an email address and password, or use the existing owner user.
3. Make sure the email is confirmed.
4. Copy that user's UUID.
5. Open Supabase **Table Editor > owner_users** and confirm there is exactly one row whose `user_id` is that UUID. Add it if it is missing.
6. The website checks the authenticated user's UUID against `owner_users`; no separate `OWNER_EMAIL` Vercel variable is required.
7. Open `/login` on the deployed site and sign in with the exact email/password from Supabase Authentication.
8. After login, `/admin` and `/admin/repair-orders` should be available.

If login says invalid email/password, verify the Supabase Authentication user and reset its password there. If login says the account is not authorized, the user's UUID is missing from `owner_users`.

## Deployment

Deploy through Vercel and add the same public environment variables in Project Settings > Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to the production domain. After deployment, test the public form, owner login, status updates, repair-order workflow, mobile navigation and desktop layout.

## Required external accounts

- Supabase
- Vercel
- Domain registrar
- Optional Resend account for email notifications

## Legal note

NW Star Diagnostics is an independent automotive diagnostics business and is not affiliated with Mercedes-Benz Group AG or the Mercedes-AMG PETRONAS Formula One Team.
