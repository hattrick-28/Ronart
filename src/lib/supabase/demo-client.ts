import "server-only";
import { addDays, todayISO } from "../format";

const today = todayISO();
const units = [
  ...Array.from({ length: 13 }, (_, i) => ({ id: `u-ap${i + 1}`, code: `AP${String(i + 1).padStart(2, "0")}`, name: `Apartamenti ${i + 1}`, type: "apartment", base_price: 45, max_guests: 2, size_m2: 28, has_balcony: (i + 1) % 3 === 0, active: true, sort: i })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `u-su${i + 1}`, code: `SU${i + 1}`, name: `Suita ${i + 1}`, type: "suite", base_price: 60, max_guests: 3, size_m2: 38, has_balcony: true, active: true, sort: 100 + i })),
];
const guests = [
  { id: "g1", full_name: "Arben Krasniqi", email: "arben@example.com", phone: "+383 44 111 222", country: "XK", is_blacklisted: false, blacklist_reason: null, no_show_count: 0, bookings: [{ count: 3 }] },
  { id: "g2", full_name: "Lena Müller", email: "lena@example.de", phone: "+49 151 2345678", country: "DE", is_blacklisted: false, blacklist_reason: null, no_show_count: 0, bookings: [{ count: 1 }] },
  { id: "g3", full_name: "Marco Rossi", email: "marco@example.it", phone: "+39 333 111 2222", country: "IT", is_blacklisted: true, blacklist_reason: "Nuk erdhi dy herë", no_show_count: 2, bookings: [{ count: 2 }] },
  { id: "g4", full_name: "Drita Berisha", email: null, phone: "+383 49 555 666", country: "XK", is_blacklisted: false, blacklist_reason: null, no_show_count: 0, bookings: [{ count: 1 }] },
];
const mk = (i: number, unit: number, ci: number, n: number, channel: string, status: string, total: number, paid: number, g: number) => ({
  id: `00000000-0000-4000-8000-0000000000b${i}`, ref: `RON-DEM00${i}`, unit_id: units[unit].id, guest_id: guests[g].id, check_in: addDays(today, ci), check_out: addDays(today, ci + n),
  adults: 2, children: 0, channel, status, payment_option: channel === "airbnb" ? "channel" : channel === "website" ? "deposit" : "on_arrival",
  total_amount: total, paid_amount: paid, deposit_amount: 0, confirm_deadline: status === "pending" ? new Date(Date.now() + 8 * 3600e3).toISOString() : null,
  hold_expires_at: null, needs_refund: false, allow_overlap: false, guest_note: i === 1 ? "Arrijmë rreth orës 22:00" : null, internal_note: null,
  units: { name: units[unit].name, type: units[unit].type }, guests: guests[g],
});
const bookings = [
  mk(1, 0, 0, 2, "website", "confirmed", 90, 45, 0), mk(2, 13, 0, 3, "booking", "confirmed", 180, 0, 1),
  mk(3, 4, -1, 1, "airbnb", "checked_in", 45, 45, 2), mk(4, 7, 2, 4, "phone", "pending", 180, 0, 3),
  mk(5, 15, 1, 5, "website", "confirmed", 300, 300, 0), mk(6, 2, 4, 2, "booking", "confirmed", 90, 0, 1),
  mk(7, 9, -2, 2, "walkin", "checked_in", 90, 90, 3),
];
const payments = [
  { id: "p1", booking_id: "00000000-0000-4000-8000-0000000000b1", amount: 45, method: "card_online", status: "succeeded", created_at: new Date().toISOString(), note: null, received_by: null, provider_ref: "TEST" },
  { id: "p2", booking_id: "00000000-0000-4000-8000-0000000000b7", amount: 90, method: "cash", status: "succeeded", created_at: new Date().toISOString(), note: null, received_by: "demo", provider_ref: null },
];
const staff = [{ user_id: "demo", full_name: "Dion Maloku", role: "owner", active: true }, { user_id: "r1", full_name: "Recepsioni", role: "reception", active: true }];
const settings = [
  { key: "hold_minutes", value: 15 }, { key: "full_payment_discount_pct", value: 5 }, { key: "free_cancellation_days", value: 3 },
  { key: "phone_confirm_hours", value: 24 }, { key: "max_active_bookings_per_contact", value: 3 }, { key: "check_in_time", value: "16:00" }, { key: "check_out_time", value: "10:00" },
];
const TABLES: Record<string, unknown[]> = { units, guests, bookings, payments, staff, settings, guest_documents: [] };

function builder(table: string) {
  let rows = [...(TABLES[table] ?? [])] as Record<string, unknown>[];
  let mode: "many" | "single" = "many";
  let head = false;
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.or = (expr: string) => { if (expr.includes("needs_refund")) rows = rows.filter((r) => r.needs_refund || r.allow_overlap); return b; };
  for (const m of ["select", "in", "not", "lt", "gt", "lte", "gte", "order", "limit", "ilike", "neq", "insert", "update", "upsert", "delete"]) {
    b[m] = (...args: unknown[]) => {
      if (m === "select" && (args[1] as { head?: boolean } | undefined)?.head) head = true;
      return chain();
    };
  }
  b.eq = (col: string, val: unknown) => {
    if (["id", "user_id", "booking_id", "key", "status", "channel"].includes(col)) rows = rows.filter((r) => r[col] === val);
    return chain();
  };
  b.single = () => { mode = "single"; return chain(); };
  b.maybeSingle = b.single;
  b.then = (resolve: (v: unknown) => void) =>
    resolve({ data: head ? null : mode === "single" ? rows[0] ?? null : rows, error: null, count: rows.length });
  return b;
}

export function demoClient() {
  return {
    from: (t: string) => builder(t),
    rpc: async () => ({ data: null, error: null }),
    auth: { getClaims: async () => ({ data: { claims: { sub: "demo", aal: "aal2", email: "demo@ronart" } } }), signOut: async () => ({}) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "/rooms/apartment.jpg" } }) }) },
  };
}
