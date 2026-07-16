# NW Star Diagnostics

Premium mobile automotive diagnostics website and private operations dashboard.

## Product direction

- Black/graphite motorsport-inspired visual system with green-teal accents
- Public marketing website for Mercedes-Benz, Sprinter, electrical and fleet diagnostics
- Secure owner-only dashboard
- Customer intake and vehicle/job data storage
- Supabase authentication, database and file storage
- Vercel deployment

## Build phases

1. Foundation: Next.js, TypeScript, styling, metadata, environment setup
2. Public site: home, services, fleet, about, FAQ, contact and service request
3. Intake system: customer, vehicle, complaint, location, uploads and consent
4. Secure dashboard: leads, customers, vehicles, jobs, status, notes and files
5. Operations: estimates, diagnostic reports, invoices, follow-ups and search
6. Launch: Supabase policies, email alerts, analytics, SEO, testing and deployment

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then add the Supabase URL and anonymous key to `.env.local`.

## Required external accounts

- Supabase
- Vercel
- Domain registrar
- Optional Resend account for email notifications

## Legal note

NW Star Diagnostics is an independent automotive diagnostics business and is not affiliated with Mercedes-Benz Group AG or the Mercedes-AMG PETRONAS Formula One Team.
