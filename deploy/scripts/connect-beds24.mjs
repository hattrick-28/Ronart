#!/usr/bin/env node
/**
 * Connects a (new) Beds24 account to the CRM.
 *
 * 1. Beds24 → Settings → Marketplace → API → "Generate invite code"
 *    Scopes: all read + write for bookings, inventory, properties. Tick "Allow linked properties".
 * 2. Run (Node 18+, no install needed):
 *      SUPABASE_URL=https://<ref>.supabase.co \
 *      SUPABASE_SECRET_KEY=sb_secret_... \
 *      node deploy/scripts/connect-beds24.mjs <INVITE_CODE>
 *
 * It stores the long-lived refresh token in the database (table integration_tokens,
 * readable only by the server) and prints the property id + room ids you need for
 * BEDS24_PROPERTY_ID and 05_beds24_mapping.sql. The invite code works once only.
 */
const BASE = "https://beds24.com/api/v2";
const code = process.argv[2];
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

if (!code || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node connect-beds24.mjs <INVITE_CODE>");
  process.exit(1);
}

const setup = await fetch(`${BASE}/authentication/setup`, { headers: { accept: "application/json", code } });
if (!setup.ok) {
  console.error(`Beds24 refused the invite code (${setup.status}). Generate a new one and try again.`);
  process.exit(1);
}
const { token, refreshToken, expiresIn } = await setup.json();

const save = await fetch(`${SUPABASE_URL}/rest/v1/integration_tokens?on_conflict=provider`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_SECRET_KEY,
    authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify({
    provider: "beds24",
    access_token: token,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }),
});
if (!save.ok) {
  console.error(`Could not save the token in Supabase (${save.status}): ${await save.text()}`);
  process.exit(1);
}
console.log("✓ Beds24 connected, token saved in Supabase.\n");

const props = await fetch(`${BASE}/properties?includeAllRooms=true`, { headers: { accept: "application/json", token } });
const { data = [] } = await props.json();
for (const p of data) {
  console.log(`BEDS24_PROPERTY_ID=${p.id}   (${p.name})`);
  for (const r of p.roomTypes ?? []) console.log(`  ${String(r.id).padEnd(10)} ${r.name}`);
}
console.log("\nPut these room ids into deploy/supabase/05_beds24_mapping.sql and run it.");
