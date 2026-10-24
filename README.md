# Ronart Apartments – booking website + staff CRM

Next.js 16 (TypeScript) · Supabase (Postgres, Auth with 2FA) · Beds24 (channel manager) · NLB e-commerce · Vercel

## How it fits together

```
Booking.com ─┐
Airbnb ──────┼── Beds24  (rooms, prices, availability, channel sync)
Website ─────┘     │  API v2 + booking webhook
                   ▼
        Supabase   (guests, bookings, payments, staff, audit log)
                   │
        Next.js on Vercel: public site + /admin staff panel
                   │
        NLB hosted payment page (3-D Secure)
```

* **Availability** = free in our DB **and** offered by Beds24 (which includes Booking.com/Airbnb).
* **Website booking**: 15-min hold (Beds24 status `request`, blocks every channel) → NLB page → signed bank
  notification confirms it. Unpaid holds expire automatically (pg_cron every minute).
* **Double booking** is impossible inside our DB (Postgres exclusion constraint). Overlapping channel bookings
  are stored, flagged "OVERBOOKING" and shown on the dashboard.
* **Payment options**: pay in full (discount) or deposit = first night now, rest at reception (cash/card).
* **Phone bookings**: "pending" auto-cancel after N hours unless confirmed.
* **Staff panel** requires password + authenticator code (2FA). The database itself refuses data to sessions
  without 2FA (RLS checks `aal2`). Roles: owner, reception.

## Environment variables (Vercel → Project → Settings → Environment Variables)

See `.env.example`. Secrets (`SUPABASE_SECRET_KEY`, `APP_SECRET`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY`,
`BEDS24_WEBHOOK_SECRET`, `NLB_*`) must be **Sensitive** and never prefixed with `NEXT_PUBLIC_`.

`BEDS24_PROPERTY_ID=363014`

## Go-live checklist

- [ ] Supabase → Authentication → disable "Allow new users to sign up"
- [ ] Create owner login, add row in `staff` (role `owner`), log in, scan 2FA QR
- [ ] Turnstile keys set
- [ ] Beds24 webhook: `https://<domain>/api/beds24/webhook?key=<BEDS24_WEBHOOK_SECRET>`
- [ ] Sync job: pg_cron calls `/api/cron/sync` every minute (see `supabase/cron.sql`)
- [ ] NLB: implement `src/lib/payments/nlb.ts` from bank docs, set `PAYMENT_PROVIDER=nlb`
- [ ] Real prices in Beds24, real photos, address, company name + NUI (`src/lib/site.ts`), legal texts reviewed
- [ ] Delete test bookings (RON-FEFC51, RON-914B0F) and the empty "New Property" in Beds24
- [ ] Only then connect Booking.com and Airbnb in Beds24

## Local development

```bash
cp .env.example .env.local   # DEMO_DATA=1 renders the public site with sample data
npm install && npm run dev
```
