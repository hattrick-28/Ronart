# Ronart: kalimi në llogari të reja (Supabase · Vercel · Beds24)

Ky dosje mjafton për ta ngritur gjithë sistemin nga zero në llogaritë e pronarit.
Koha: rreth 1 orë. Rendi ka rëndësi.

| Skedari | Çka bën |
|---|---|
| `supabase/01_schema.sql` | Gjithë databaza: tabelat, rregullat e sigurisë, funksionet, storage për letërnjoftime |
| `supabase/02_seed.sql` | 13 apartamentet + 5 suitat dhe rregullat e rezervimit |
| `supabase/03_cron_sync.sql` | Sinkronizimi me Beds24 çdo minutë |
| `supabase/04_owner.sql` | E bën llogarinë e pronarit "owner" në CRM |
| `supabase/05_beds24_mapping.sql` | Lidh çdo dhomë me ID-në e re në Beds24 |
| `beds24/property.json` · `rooms-mapping.csv` | Prona dhe 18 dhomat (emrat, çmimet, kapaciteti, ID-të e vjetra) |
| `vercel/env-template.env` | Të gjitha variablat që duhen në Vercel |
| `scripts/connect-beds24.mjs` | Lidh Beds24 me CRM dhe printon ID-të e dhomave |
| `ronart-code.zip` | Kodi i plotë i website + CRM |

> Asnjë fjalëkalim apo çelës sekret nuk është në këto skedarë. Çelësat e rinj krijohen në llogaritë e reja.

---

## 0. Para se të filloni

- Email biznesi (p.sh. `info@ronartapartments.com`) me të cilin hapen të gjitha llogaritë.
- Kartela që paguan abonimet.
- Domain-i `ronartapartments.com` (i blerë në Vercel ose diku tjetër).

## 1. GitHub (kodi)

1. Krijo llogari GitHub me emailin e biznesit → **New repository** → `ronart` → **Private**.
2. Hape `ronart-code.zip`, ngarko përmbajtjen (ose `git push` nga kompjuteri).
   - Alternativë: në repo-n ekzistues `hattrick-28/Ronart` → Settings → **Transfer ownership** te llogaria e re (më e lehtë, ruan historinë).

## 2. Supabase (databaza)

1. supabase.com → New project → emri `ronart`, regjioni **Frankfurt (eu-central-1)**, fjalëkalim i fortë (ruaje).
2. **SQL Editor** → ekzekuto me radhë: `01_schema.sql`, pastaj `02_seed.sql`.
3. **Authentication → Users → Add user** → emaili i pronarit + fjalëkalim, "Auto Confirm".
4. Ndrysho `<OWNER_EMAIL>` / `<OWNER_NAME>` te `04_owner.sql` dhe ekzekutoje.
5. **Authentication → Sign In / Providers**: çaktivizo "Allow new users to sign up" (vetëm stafi i ftuar hyn).
6. **Authentication → Multi-Factor**: TOTP duhet të jetë **Enabled**.
7. **Authentication → URL Configuration**: Site URL = `https://ronartapartments.com`, dhe shto edhe `https://<projekti>.vercel.app/**` te Redirect URLs.
8. Merr nga **Project Settings → API Keys**: URL, *publishable key*, *secret key* (për hapin 3).
9. Plani: **Pro (25 $/muaj)** rekomandohet për biznes (backup ditor, pa pauzë pas 7 ditësh).

## 3. Vercel (website + CRM)

1. vercel.com me emailin e biznesit → plani **Pro (20 $/muaj)**, sepse Hobby nuk lejohet për përdorim komercial.
2. **Add New → Project → Import** repo-n `ronart` nga GitHub. Framework: Next.js (vetë e njeh).
3. Para Deploy, te **Environment Variables** shto çdo rresht nga `vercel/env-template.env`.
   - Çelësat e rastësishëm: `openssl rand -hex 32` (ose çdo gjenerator fjalëkalimesh, 64 shkronja).
   - `PAYMENT_PROVIDER=mock` deri sa NLB të japë të dhënat.
4. **Deploy**. Pastaj **Settings → Domains** → shto `ronartapartments.com` dhe `www.`, ndiq udhëzimet DNS.
   - ⚠️ Kur shtohet domain-i, website bëhet **publik**. Shtoje vetëm kur jeni gati, ose aktivizo mbrojtjen "All deployments".
5. Nëse e mban mbrojtjen gjatë testimit: **Settings → Deployment Protection → Protection Bypass for Automation** → krijo, ruaje vlerën (duhet në hapat 4 dhe 5).

## 4. Beds24 (channel manager)

1. Llogari e re në beds24.com me emailin e biznesit (ose kalo pronën ekzistuese: Beds24 support mund ta transferojë **363014** te llogaria e re, që ruan lidhjet me Booking/Airbnb).
2. Nëse fillon nga zero: **Settings → Properties → Add property** "Ronart Apartments", Kosovë, EUR, check-in 16:00, check-out 10:00. Krijo 18 dhomat sipas `beds24/rooms-mapping.csv` (qty 1 secila).
3. **Settings → Marketplace → API** → *Generate invite code* (të gjitha të drejtat read/write).
4. Në kompjuter me Node 18+:
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_... \
     node deploy/scripts/connect-beds24.mjs <INVITE_CODE>
   ```
   Printon `BEDS24_PROPERTY_ID` dhe ID-të e 18 dhomave.
5. Vendos `BEDS24_PROPERTY_ID` në Vercel (Settings → Environment Variables) → **Redeploy**.
6. Plotëso ID-të te `05_beds24_mapping.sql` → ekzekuto në Supabase SQL Editor.
7. Webhook: Beds24 → **Settings → Properties → Access → Booking Webhook** (v2), URL:
   ```
   https://ronartapartments.com/api/beds24/webhook?key=<BEDS24_WEBHOOK_SECRET>
   ```
   Nëse Vercel është ende i mbrojtur, shto në fund: `&x-vercel-protection-bypass=<VERCEL_BYPASS>`
8. Çmimet: vendosen nga CRM → **Çmimet** (shkojnë direkt në Beds24 dhe në Booking/Airbnb).

## 5. Sinkronizimi automatik

Te `03_cron_sync.sql` ndrysho `<SITE_URL>`, `<CRON_SECRET>` (i njëjtë si në Vercel), `<VERCEL_BYPASS>` (ose `''`) → ekzekuto në Supabase.

## 6. Cloudflare Turnstile (mbrojtje nga botët)

dash.cloudflare.com → **Turnstile → Add widget** → hostnames: `ronartapartments.com`, `www.ronartapartments.com`, `<projekti>.vercel.app` → çelësat te Vercel → Redeploy.

## 7. Kontrolli përfundimtar ✅

- [ ] Website hapet, dhomat shfaqen me çmime 45 € / 60 €.
- [ ] Hyrja në `/admin` → kërkon 2FA → Paneli "Sot" hapet.
- [ ] Rezervim test në website → shfaqet në CRM **dhe** në Beds24 brenda 1 minute.
- [ ] Anulo rezervimin test në CRM → anulohet edhe në Beds24.
- [ ] Rezervim manual në Beds24 → shfaqet në CRM.
- [ ] Supabase → **Advisors → Security**: pa gabime kritike.
- [ ] Fshi rezervimet test, kalo `PAYMENT_PROVIDER=nlb` kur NLB jep të dhënat.

## 8. Pas kalimit

- Llogaritë e vjetra (Supabase/Vercel/Beds24 të zhvilluesit) mbyllen vetëm pasi gjithçka punon 1 javë.
- Zhvilluesi mbetet anëtar (Developer/Member) në Vercel, Supabase dhe GitHub për mirëmbajtje; pronari është **Owner** kudo.
