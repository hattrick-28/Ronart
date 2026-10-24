"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { pushBooking } from "@/lib/sync";
import { nightsBetween } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { todayISO } from "@/lib/format";

const back = (path: string, kind: "ok" | "err", msg: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

async function syncQuietly(bookingId: string) {
  try {
    await pushBooking(bookingId);
  } catch (e) {
    console.error("beds24 push failed, queued for retry", e);
    await createAdminClient().from("bookings").update({ beds24_sync_needed: true }).eq("id", bookingId);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/* ---------------- bookings ---------------- */

const PaymentForm = z.object({
  bookingId: z.uuid(),
  amount: z.coerce.number().positive().max(100000),
  method: z.enum(["cash", "card_pos", "bank_transfer"]),
  note: z.string().max(300).optional(),
});

export async function recordPayment(fd: FormData) {
  const me = await requireStaff();
  const p = PaymentForm.safeParse(Object.fromEntries(fd));
  const path = `/admin/bookings/${fd.get("bookingId")}`;
  if (!p.success) back(path, "err", "Shuma nuk është e vlefshme.");
  const v = p.data!;
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    booking_id: v.bookingId, amount: v.amount, method: v.method, status: "succeeded",
    received_by: me.userId, note: v.note || null,
  });
  if (error) back(path, "err", "Pagesa nuk u regjistrua: " + error.message);
  revalidatePath("/admin", "layout");
  back(path, "ok", "Pagesa u regjistrua.");
}

const TRANSITIONS: Record<string, string[]> = {
  hold: ["cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export async function setBookingStatus(fd: FormData) {
  await requireStaff();
  const id = z.uuid().parse(fd.get("bookingId"));
  const to = z.enum(["confirmed", "checked_in", "checked_out", "cancelled", "no_show"]).parse(fd.get("to"));
  const reason = String(fd.get("reason") ?? "").slice(0, 300) || null;
  const path = `/admin/bookings/${id}`;
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("status, channel, guest_id").eq("id", id).single();
  if (!b) back(path, "err", "Rezervimi nuk u gjet.");
  if (!TRANSITIONS[b!.status]?.includes(to)) back(path, "err", "Ky ndryshim statusi nuk lejohet.");
  const patch: Record<string, unknown> = { status: to };
  if (to === "confirmed") patch.confirm_deadline = null;
  if (to === "cancelled") patch.cancelled_reason = reason ?? "cancelled_by_staff";
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) back(path, "err", error.code === "23P01" ? "Dhoma është e zënë për këto data." : error.message);

  if (to === "no_show" && b!.guest_id) {
    const { data: g } = await supabase.from("guests").select("no_show_count").eq("id", b!.guest_id).single();
    await supabase.from("guests").update({ no_show_count: (g?.no_show_count ?? 0) + 1 }).eq("id", b!.guest_id);
  }
  // Channel bookings: Booking.com/Airbnb own them; staff changes stay local except cancellations must be done on the channel.
  if (b!.channel !== "booking" && b!.channel !== "airbnb") await syncQuietly(id);
  revalidatePath("/admin", "layout");
  const msg: Record<string, string> = {
    confirmed: "Rezervimi u konfirmua.", checked_in: "Mysafiri u regjistrua brenda.", checked_out: "Mysafiri u largua.",
    cancelled: (b!.channel === "booking" || b!.channel === "airbnb") ? "U anulua këtu. Anuloje edhe në platformë!" : "Rezervimi u anulua dhe dhoma u lirua kudo.",
    no_show: "U shënua si mosparaqitje.",
  };
  back(path, "ok", msg[to]);
}

export async function saveInternalNote(fd: FormData) {
  await requireStaff();
  const id = z.uuid().parse(fd.get("bookingId"));
  const note = String(fd.get("note") ?? "").slice(0, 2000);
  const supabase = await createClient();
  await supabase.from("bookings").update({ internal_note: note || null }).eq("id", id);
  back(`/admin/bookings/${id}`, "ok", "Shënimi u ruajt.");
}

const ManualBooking = z.object({
  unitId: z.uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(10),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  email: z.union([z.literal(""), z.email()]).optional(),
  channel: z.enum(["phone", "walkin"]),
  mode: z.enum(["pending", "confirmed"]),
  total: z.coerce.number().min(0).max(100000),
  note: z.string().max(1000).optional(),
});

export async function createManualBooking(fd: FormData) {
  const me = await requireStaff();
  const p = ManualBooking.safeParse(Object.fromEntries(fd));
  const path = "/admin/bookings/new";
  if (!p.success) back(path, "err", "Kontrollo fushat: " + p.error.issues.map((i) => i.path.join(".")).join(", "));
  const v = p.data!;
  const nights = nightsBetween(v.checkIn, v.checkOut);
  if (nights < 1 || nights > 60) back(path, "err", "Datat nuk janë të vlefshme.");
  if (v.checkIn < todayISO()) back(path, "err", "Data e ardhjes është në të kaluarën.");

  const supabase = await createClient();
  const s = await getSettings();

  // find or create guest (match phone, then email)
  let guestId: string | null = null;
  const { data: byPhone } = await supabase.from("guests").select("id, is_blacklisted, blacklist_reason").eq("phone", v.phone).limit(1).maybeSingle();
  let found = byPhone;
  if (!found && v.email) {
    const { data: byEmail } = await supabase.from("guests").select("id, is_blacklisted, blacklist_reason").eq("email", v.email.toLowerCase()).limit(1).maybeSingle();
    found = byEmail;
  }
  if (found?.is_blacklisted && fd.get("override") !== "on") {
    back(path, "err", `Ky mysafir është në listën e bllokuar (${found.blacklist_reason ?? "pa arsye"}). Kërkohet miratimi i pronarit.`);
  }
  if (found) guestId = found.id;
  else {
    const { data: g, error } = await supabase.from("guests")
      .insert({ full_name: v.fullName, phone: v.phone, email: v.email ? v.email.toLowerCase() : null })
      .select("id").single();
    if (error) back(path, "err", error.message);
    guestId = g!.id;
  }

  const { data: b, error } = await supabase.from("bookings").insert({
    unit_id: v.unitId, guest_id: guestId, check_in: v.checkIn, check_out: v.checkOut, adults: v.adults,
    channel: v.channel, status: v.mode, payment_option: "on_arrival", total_amount: v.total,
    confirm_deadline: v.mode === "pending" ? new Date(Date.now() + s.phone_confirm_hours * 3600_000).toISOString() : null,
    internal_note: v.note || null, created_by: me.userId,
  }).select("id").single();
  if (error) back(path, "err", error.code === "23P01" ? "Dhoma është e zënë për këto data." : error.message);

  await syncQuietly(b!.id);
  revalidatePath("/admin", "layout");
  back(`/admin/bookings/${b!.id}`, "ok", v.mode === "pending"
    ? `Rezervimi u krijua. Anulohet automatikisht pas ${s.phone_confirm_hours} orësh nëse nuk konfirmohet.`
    : "Rezervimi u krijua dhe dhoma u mbyll kudo.");
}

/* ---------------- guests ---------------- */

export async function setBlacklist(fd: FormData) {
  await requireStaff();
  const id = z.uuid().parse(fd.get("guestId"));
  const on = fd.get("on") === "1";
  const reason = String(fd.get("reason") ?? "").slice(0, 300);
  const supabase = await createClient();
  await supabase.from("guests").update({ is_blacklisted: on, blacklist_reason: on ? reason || "Pa arsye" : null }).eq("id", id);
  revalidatePath("/admin/guests");
  back(String(fd.get("back") ?? "/admin/guests"), "ok", on ? "Mysafiri u bllokua." : "Bllokimi u hoq.");
}

/* ---------------- owner only ---------------- */

export async function updateSettings(fd: FormData) {
  await requireStaff({ owner: true });
  const supabase = await createClient();
  const numeric = ["hold_minutes", "full_payment_discount_pct", "free_cancellation_days", "phone_confirm_hours", "max_active_bookings_per_contact", "id_doc_retention_days", "guest_data_retention_years"];
  const limits: Record<string, [number, number]> = {
    hold_minutes: [5, 60], full_payment_discount_pct: [0, 30], free_cancellation_days: [0, 60],
    phone_confirm_hours: [1, 168], max_active_bookings_per_contact: [1, 18],
    id_doc_retention_days: [1, 365], guest_data_retention_years: [1, 10],
  };
  for (const k of numeric) {
    const n = Number(fd.get(k));
    if (!Number.isFinite(n) || n < limits[k][0] || n > limits[k][1]) back("/admin/settings", "err", `Vlera për ${k} nuk lejohet.`);
    await supabase.from("settings").update({ value: n, updated_at: new Date().toISOString() }).eq("key", k);
  }
  for (const k of ["check_in_time", "check_out_time"]) {
    const t = String(fd.get(k));
    if (!/^\d{2}:\d{2}$/.test(t)) back("/admin/settings", "err", "Ora duhet të jetë në formatin 14:00.");
    await supabase.from("settings").update({ value: t, updated_at: new Date().toISOString() }).eq("key", k);
  }
  let synced = true;
  try {
    const { updateProperty } = await import("@/lib/beds24");
    await updateProperty({ checkInStart: String(fd.get("check_in_time")), checkOutEnd: String(fd.get("check_out_time")) });
  } catch (e) {
    synced = false;
    console.error("property times sync failed", e);
  }
  revalidatePath("/", "layout");
  back("/admin/settings", synced ? "ok" : "err", synced ? "Rregullat u ruajtën. Oraret e check-in/out u përditësuan edhe te kanalet." : "Rregullat u ruajtën, por oraret nuk u dërguan te kanalet. Provo përsëri.");
}

export async function updateUnit(fd: FormData) {
  await requireStaff({ owner: true });
  const v = z.object({
    id: z.uuid(), name: z.string().trim().min(2).max(60),
    max_guests: z.coerce.number().int().min(1).max(10), size_m2: z.coerce.number().int().min(0).max(500),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) back("/admin/settings", "err", "Të dhënat e dhomës nuk janë të vlefshme.");
  const supabase = await createClient();
  const { id, ...rest } = v.data!;
  const { data: unit, error } = await supabase.from("units")
    .update({ ...rest, has_balcony: fd.get("has_balcony") === "on", active: fd.get("active") === "on" })
    .eq("id", id).select("beds24_room_id").single();
  if (error) back("/admin/settings", "err", error.message);
  if (unit?.beds24_room_id) {
    try {
      const { updateProperty } = await import("@/lib/beds24");
      await updateProperty({ rooms: [{ id: Number(unit.beds24_room_id), name: rest.name, maxPeople: rest.max_guests }] });
    } catch (e) {
      console.error("room sync failed", e);
      back("/admin/settings", "err", "Njësia u ruajt këtu, por nuk u dërgua te kanalet. Provo përsëri.");
    }
  }
  back("/admin/settings", "ok", `${rest.name} u ruajt (edhe te menaxheri i kanaleve).`);
}

export async function inviteStaff(fd: FormData) {
  await requireStaff({ owner: true });
  const v = z.object({ email: z.email(), full_name: z.string().trim().min(2).max(80), role: z.enum(["owner", "reception"]) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) back("/admin/settings", "err", "Plotëso emrin, emailin dhe rolin.");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(v.data!.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/login`,
  });
  if (error || !data.user) back("/admin/settings", "err", "Ftesa nuk u dërgua: " + (error?.message ?? ""));
  // insert through the owner's own session so RLS and the audit log apply
  const supabase = await createClient();
  const { error: e2 } = await supabase.from("staff").insert({ user_id: data.user!.id, full_name: v.data!.full_name, role: v.data!.role });
  if (e2) back("/admin/settings", "err", e2.message);
  back("/admin/settings", "ok", `Ftesa u dërgua te ${v.data!.email}.`);
}

export async function setStaffActive(fd: FormData) {
  const me = await requireStaff({ owner: true });
  const id = z.uuid().parse(fd.get("userId"));
  if (id === me.userId) back("/admin/settings", "err", "Nuk mund ta çaktivizosh veten.");
  const supabase = await createClient();
  await supabase.from("staff").update({ active: fd.get("active") === "1" }).eq("user_id", id);
  back("/admin/settings", "ok", "Stafi u përditësua.");
}

export async function markRefunded(fd: FormData) {
  await requireStaff({ owner: true });
  const id = z.uuid().parse(fd.get("bookingId"));
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("internal_note").eq("id", id).single();
  await supabase.from("bookings").update({
    needs_refund: false,
    internal_note: [b?.internal_note, `Rimbursimi u krye ${todayISO()}.`].filter(Boolean).join("\n"),
  }).eq("id", id);
  back(`/admin/bookings/${id}`, "ok", "U shënua si i rimbursuar.");
}

/* ---------------- prices (owner) ---------------- */

export async function savePrices(fd: FormData) {
  await requireStaff({ owner: true });
  const path = "/admin/prices";
  const v = z.object({
    scope: z.enum(["apartment", "suite", "selected"]),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.coerce.number().min(1).max(5000),
    minStay: z.union([z.literal(""), z.coerce.number().int().min(1).max(30)]).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) back(path, "err", "Kontrollo datat dhe çmimin.");
  const p = v.data!;
  if (p.to < p.from) back(path, "err", "Data 'deri' duhet të jetë pas datës 'nga'.");
  if (p.from < todayISO()) back(path, "err", "Nuk mund të ndryshohen çmimet në të kaluarën.");

  const supabase = await createClient();
  let q = supabase.from("units").select("id, beds24_room_id, type").eq("active", true);
  if (p.scope === "selected") {
    const ids = fd.getAll("unit").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
    if (!ids.length) back(path, "err", "Zgjidh të paktën një njësi.");
    q = q.in("id", ids);
  } else q = q.eq("type", p.scope);
  const { data: units } = await q;
  const roomIds = (units ?? []).map((u) => u.beds24_room_id).filter(Boolean) as number[];
  if (!roomIds.length) back(path, "err", "Njësitë nuk janë të lidhura me kanalet.");

  try {
    const { setPrices } = await import("@/lib/beds24");
    await setPrices(roomIds, p.from, p.to, p.price, p.minStay ? Number(p.minStay) : undefined);
  } catch (e) {
    back(path, "err", "Çmimi nuk u ruajt: " + (e as Error).message);
  }
  // Keep the fallback price in line when the change covers today.
  if (p.from <= todayISO() && p.to >= todayISO()) {
    await supabase.from("units").update({ base_price: p.price }).in("id", (units ?? []).map((u) => u.id));
  }
  revalidatePath("/", "layout");
  back(path, "ok", `Çmimi ${p.price} € u vendos për ${roomIds.length} njësi (${p.from} – ${p.to}). Booking.com dhe Airbnb përditësohen vetë.`);
}

/* ---------------- guest ID documents ---------------- */

export async function registerDocument(input: { guestId: string; bookingId: string; path: string; kind: string }) {
  const me = await requireStaff();
  const v = z.object({
    guestId: z.uuid(), bookingId: z.uuid(),
    path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|pdf)$/),
    kind: z.enum(["id_card", "passport", "driving_licence", "other"]),
  }).safeParse(input);
  if (!v.success || !v.data.path.startsWith(v.data.guestId + "/")) return { error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { error } = await supabase.from("guest_documents").insert({
    guest_id: v.data.guestId, booking_id: v.data.bookingId, storage_path: v.data.path, kind: v.data.kind, uploaded_by: me.userId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${v.data.bookingId}`);
  return { ok: true };
}

export async function deleteDocument(input: { docId: string; bookingId: string }) {
  const me = await requireStaff();
  const v = z.object({ docId: z.uuid(), bookingId: z.uuid() }).safeParse(input);
  if (!v.success) return { error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("guest_documents").select("id, storage_path, guest_id, kind").eq("id", v.data.docId).single();
  if (!doc) return { error: "Dokumenti nuk u gjet." };
  const { error: stErr } = await supabase.storage.from("guest-ids").remove([doc.storage_path]);
  if (stErr) return { error: stErr.message };
  const { error } = await supabase.from("guest_documents").delete().eq("id", doc.id);
  if (error) return { error: error.message };
  await createAdminClient().from("audit_log").insert({
    actor: me.userId, action: "delete", entity: "guest_documents", entity_id: doc.id, data: { guest_id: doc.guest_id, kind: doc.kind },
  });
  revalidatePath(`/admin/bookings/${v.data.bookingId}`);
  return { ok: true };
}
