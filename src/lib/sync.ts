import "server-only";
import { createAdminClient } from "./supabase/admin";
import { beds24Connected, getBooking, listModifiedBookings, upsertBooking, type B24Booking } from "./beds24";

type Status = "hold" | "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";

/** Our status → Beds24 status. "request" was tested to block the room on all channels. */
function toBeds24Status(s: Status): string {
  if (s === "hold" || s === "pending") return "request";
  if (s === "cancelled" || s === "no_show") return "cancelled";
  return "confirmed";
}

/** Pushes one booking to Beds24 (create or update). Safe to call repeatedly. */
export async function pushBooking(bookingId: string): Promise<void> {
  if (!(await beds24Connected())) return;
  const db = createAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select("id, ref, status, check_in, check_out, adults, children, total_amount, guest_note, channel, beds24_booking_id, units(beds24_room_id), guests(full_name, email, phone)")
    .eq("id", bookingId)
    .single();
  if (!b) return;
  // Channel bookings belong to Booking.com/Airbnb; Beds24 already has them.
  if (b.channel === "booking" || b.channel === "airbnb") {
    await db.from("bookings").update({ beds24_sync_needed: false }).eq("id", b.id);
    return;
  }
  const unit = b.units as unknown as { beds24_room_id: number | null } | null;
  const guest = b.guests as unknown as { full_name: string; email: string | null; phone: string | null } | null;
  if (!unit?.beds24_room_id) return;
  const [firstName, ...rest] = (guest?.full_name ?? "Guest").split(" ");
  const id = await upsertBooking({
    ...(b.beds24_booking_id ? { id: Number(b.beds24_booking_id) } : {}),
    roomId: unit.beds24_room_id,
    status: toBeds24Status(b.status as Status),
    arrival: b.check_in,
    departure: b.check_out,
    numAdult: b.adults,
    numChild: b.children,
    firstName,
    lastName: rest.join(" ") || "-",
    email: guest?.email ?? undefined,
    phone: guest?.phone ?? undefined,
    price: Number(b.total_amount),
    // Beds24 does not keep apiReference/referer for API bookings, so the ref goes in the notes.
    notes: [`${b.ref} · ${b.channel === "website" ? "Faqja Ronart" : "Paneli Ronart"}`, b.guest_note].filter(Boolean).join("\n"),
  });
  await db.from("bookings").update({ beds24_booking_id: id, beds24_sync_needed: false }).eq("id", b.id);
}

export async function processSyncQueue(limit = 20) {
  const db = createAdminClient();
  await db.rpc("expire_stale_bookings");
  const { data } = await db.from("bookings").select("id").eq("beds24_sync_needed", true).limit(limit);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const row of data ?? []) {
    try {
      await pushBooking(row.id);
      results.push({ id: row.id, ok: true });
    } catch (e) {
      results.push({ id: row.id, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

function channelOf(b: B24Booking): "booking" | "airbnb" | "other" | "phone" {
  const s = `${b.channel ?? ""} ${b.referer ?? ""}`.toLowerCase();
  if (s.includes("booking")) return "booking";
  if (s.includes("airbnb")) return "airbnb";
  return "other";
}

function fromBeds24Status(s: string): Status {
  if (s === "cancelled") return "cancelled";
  if (s === "request" || s === "inquiry") return "pending";
  return "confirmed";
}

/** Imports or updates a booking that originated in Beds24 (Booking.com, Airbnb, or made in Beds24 directly). */
export async function importBeds24Booking(b: B24Booking) {
  const db = createAdminClient();

  const OURS = ["website", "phone", "walkin"];
  const { data: mine } = await db.from("bookings").select("id, channel, status").eq("beds24_booking_id", b.id).maybeSingle();
  const refInNotes = /RON-[A-Z0-9]{6}/.exec(`${b.notes ?? ""} ${b.apiReference ?? ""}`)?.[0];

  // Our own website/staff booking echoed back by Beds24: never overwrite it, only follow a cancellation made in Beds24.
  if ((mine && OURS.includes(mine.channel)) || refInNotes || b.referer === "API") {
    if (b.status === "cancelled") {
      const q = db.from("bookings").update({ status: "cancelled", cancelled_reason: "cancelled_in_beds24" })
        .in("status", ["hold", "pending", "confirmed"]);
      if (mine) await q.eq("id", mine.id);
      else if (refInNotes) await q.eq("ref", refInNotes);
    }
    return { action: "own_booking" };
  }

  const { data: unit } = await db.from("units").select("id").eq("beds24_room_id", b.roomId).maybeSingle();
  if (!unit) return { action: "unknown_room" };

  const fullName = [b.firstName, b.lastName].filter(Boolean).join(" ").trim() || "Guest";
  const email = b.email?.toLowerCase() || null;
  let guestId: string | null = null;
  if (email) {
    const { data: g } = await db.from("guests").select("id").eq("email", email).maybeSingle();
    guestId = g?.id ?? null;
  }
  if (!guestId) {
    const { data: g } = await db.from("guests")
      .insert({ full_name: fullName, email, phone: b.phone || b.mobile || null, country: b.country2 || b.country || null })
      .select("id").single();
    guestId = g!.id;
  }

  const row = {
    unit_id: unit.id,
    guest_id: guestId,
    check_in: b.arrival,
    check_out: b.departure,
    adults: Math.max(1, b.numAdult ?? 1),
    children: b.numChild ?? 0,
    channel: channelOf(b),
    status: fromBeds24Status(b.status),
    payment_option: channelOf(b) === "airbnb" ? "channel" : "on_arrival",
    total_amount: Number(b.price ?? 0),
    beds24_booking_id: b.id,
    guest_note: b.comments || b.notes || null,
    beds24_sync_needed: false,
  } as const;

  const existing = mine;
  const write = existing
    ? db.from("bookings").update(row).eq("id", existing.id)
    : db.from("bookings").insert(row);
  const { error } = await write;
  if (error?.code === "23P01") {
    // Overbooking: the channel booking is real, so store it and flag it loudly.
    const flagged = { ...row, allow_overlap: true, internal_note: "OVERBOOKING: this channel booking overlaps another booking. Resolve now." };
    if (existing) await db.from("bookings").update(flagged).eq("id", existing.id);
    else await db.from("bookings").insert(flagged);
    return { action: "overbooking" };
  }
  if (error) throw new Error(error.message);
  return { action: existing ? "updated" : "created" };
}

export async function importBeds24BookingById(id: number) {
  const b = await getBooking(id);
  if (!b) return { action: "not_found" };
  return importBeds24Booking(b);
}

/** Safety net for missed webhooks: pulls bookings modified recently. */
export async function pullRecentChanges(minutes = 30) {
  if (!(await beds24Connected())) return [];
  const since = new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 19);
  const list = await listModifiedBookings(since);
  const out = [];
  for (const b of list) out.push(await importBeds24Booking(b));
  return out;
}
