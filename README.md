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
- Server-side validation and rate limiting
- Supabase RPC intake that does not expose table access to anonymous visitors
- Owner email/password authentication
- Protected `/admin` dashboard
- Live customer, vehicle and request records
- Request pipeline counts and status updates
- Row-level database security through an explicit `owner_users` allowlist

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
- `OWNER_EMAIL`: the exact email used for the owner login

Never commit `.env.local`, a Supabase secret key, or a service-role key.

## Supabase setup

1. Open the Supabase SQL Editor and run all of `supabase/schema.sql`.
2. Open Authentication > Users and create the owner email/password account.
3. Copy that user's UUID.
4. Open Table Editor > `owner_users` and add one row with that UUID in `user_id`.
5. Confirm the same email is set as `OWNER_EMAIL` in the local and production environment.
6. Submit one test request through `/request-service` and confirm it appears in `/admin`.

The dashboard remains blocked unless both checks pass: the signed-in email must match `OWNER_EMAIL`, and the Supabase user UUID must exist in `owner_users`.

## Deployment

Deploy through Vercel and add the same environment variables in Project Settings > Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to the production domain. After deployment, test the public form, owner login, status updates, mobile navigation and desktop layout.

## Required external accounts

- Supabase
- Vercel
- Domain registrar
- Optional Resend account for email notifications

## Legal note

NW Star Diagnostics is an independent automotive diagnostics business and is not affiliated with Mercedes-Benz Group AG or the Mercedes-AMG PETRONAS Formula One Team.
