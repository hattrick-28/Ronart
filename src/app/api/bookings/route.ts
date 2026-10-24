import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchAvailability } from "@/lib/availability";
import { quote, nightsBetween } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getPaymentProvider } from "@/lib/payments";
import { pushBooking } from "@/lib/sync";
import { beds24Connected } from "@/lib/beds24";
import { todayISO, addDays } from "@/lib/format";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Body = z.object({
  unitId: z.uuid(),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10),
  fullName: z.string().trim().min(3).max(100),
  email: z.email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/),
  country: z.string().trim().max(60).optional(),
  note: z.string().trim().max(500).optional(),
  option: z.enum(["full", "deposit"]),
  acceptTerms: z.literal(true),
  turnstileToken: z.string().max(4096).nullable().optional(),
  lang: z.enum(["sq", "en"]),
});

const fail = (code: string, status = 400) => NextResponse.json({ error: code }, { status });

export async function POST(req: Request) {
  // Same-origin only: blocks other sites from posting bookings through a visitor's browser.
  const origin = req.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin && site && new URL(origin).host !== new URL(site).host && process.env.NODE_ENV === "production") {
    return fail("bad_origin", 403);
  }

  const ip = clientIp(req.headers);
  if (!(await rateLimit("booking", ip, 5, 600))) return fail("rate", 429);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return fail("invalid");
  }

  if (!(await verifyTurnstile(body.turnstileToken ?? null, ip))) return fail("captcha", 403);
  if (!(await rateLimit("booking-email", body.email.toLowerCase(), 5, 3600))) return fail("rate", 429);

  const today = todayISO();
  const nights = nightsBetween(body.checkIn, body.checkOut);
  if (body.checkIn < today || nights < 1 || nights > 30 || body.checkIn > addDays(today, 540)) return fail("invalid");

  const settings = await getSettings();

  // Live check (our DB + Beds24, which includes Booking.com and Airbnb)
  let unit;
  try {
    const all = await searchAvailability(body.checkIn, body.checkOut, body.adults + body.children);
    unit = all.find((u) => u.id === body.unitId);
  } catch (e) {
    console.error("availability check failed", e);
    return fail("generic", 503);
  }
  if (!unit) return fail("invalid");
  if (!unit.available) return fail("unavailable", 409);

  const q = quote(unit.stayPrice / nights, nights, settings.full_payment_discount_pct, unit.stayPrice);
  const total = body.option === "full" ? q.fullNow : q.total;
  const deposit = body.option === "full" ? q.fullNow : q.depositNow;
  const charge = deposit;
  const provider = getPaymentProvider();

  const db = createAdminClient();
  const { data, error } = await db.rpc("create_web_booking", {
    p_unit_id: unit.id,
    p_check_in: body.checkIn,
    p_check_out: body.checkOut,
    p_adults: body.adults,
    p_children: body.children,
    p_full_name: body.fullName,
    p_email: body.email,
    p_phone: body.phone,
    p_country: body.country ?? null,
    p_note: body.note ?? null,
    p_option: body.option,
    p_total: total,
    p_deposit: deposit,
    p_charge: charge,
    p_hold_minutes: settings.hold_minutes,
    p_max_active: settings.max_active_bookings_per_contact,
    p_provider: provider.name,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("create_web_booking failed", error);
    return fail("generic", 500);
  }
  if (row.error) {
    const map: Record<string, [string, number]> = {
      unavailable: ["unavailable", 409],
      blocked: ["blocked", 403],
      too_many_active: ["limit", 429],
    };
    const [code, status] = map[row.error] ?? ["generic", 400];
    return fail(code, status);
  }

  // Block the room on every channel right away. If Beds24 can't be reached, release the hold.
  if (await beds24Connected()) {
    try {
      await pushBooking(row.booking_id);
    } catch (e) {
      console.error("beds24 push failed", e);
      await db.from("bookings").update({ status: "cancelled", cancelled_reason: "channel_sync_failed" }).eq("id", row.booking_id);
      return fail("generic", 503);
    }
  }

  try {
    const session = await provider.createSession({
      paymentId: row.payment_id,
      bookingRef: row.booking_ref,
      amount: charge,
      currency: "EUR",
      description: `Ronart ${row.booking_ref} – ${unit.name}`,
      lang: body.lang,
      customerEmail: body.email,
    });
    return NextResponse.json({ redirectUrl: session.redirectUrl, ref: row.booking_ref });
  } catch (e) {
    console.error("payment session failed", e);
    await db.from("bookings").update({ status: "cancelled", cancelled_reason: "payment_session_failed", beds24_sync_needed: true }).eq("id", row.booking_id);
    return fail("generic", 503);
  }
}
