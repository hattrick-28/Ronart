import "server-only";
import { createAdminClient } from "./supabase/admin";

const BASE = "https://beds24.com/api/v2";

export type B24Booking = {
  id: number;
  roomId: number;
  propertyId?: number;
  status: string; // confirmed | request | new | cancelled | black | inquiry
  arrival: string;
  departure: string;
  numAdult?: number;
  numChild?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  country?: string;
  country2?: string;
  price?: number;
  deposit?: number;
  channel?: string;
  referer?: string;
  apiReference?: string;
  notes?: string;
  comments?: string;
};

export type RoomOffer = { roomId: number; price: number; unitsAvailable: number };

/** Stored refresh token means Beds24 is connected. */
export async function beds24Connected(): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("integration_tokens")
    .select("refresh_token")
    .eq("provider", "beds24")
    .maybeSingle();
  return Boolean(data?.refresh_token);
}

async function getToken(): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("integration_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("provider", "beds24")
    .maybeSingle();
  if (!data?.refresh_token) return null;
  if (data.access_token && data.expires_at && Date.parse(data.expires_at) > Date.now() + 60_000) {
    return data.access_token;
  }
  const res = await fetch(`${BASE}/authentication/token`, {
    headers: { accept: "application/json", refreshToken: data.refresh_token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Beds24 token refresh failed (${res.status})`);
  const json = (await res.json()) as { token: string; expiresIn: number };
  await db
    .from("integration_tokens")
    .update({
      access_token: json.token,
      expires_at: new Date(Date.now() + (json.expiresIn - 300) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "beds24");
  return json.token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Beds24 is not connected");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) throw new Error("Beds24 rate limit reached");
  if (!res.ok) throw new Error(`Beds24 ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

/** Exchanges a one-time invite code (Settings → Marketplace → API) for a refresh token. */
export async function connectWithInviteCode(code: string) {
  const res = await fetch(`${BASE}/authentication/setup`, {
    headers: { accept: "application/json", code },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Kodi i lidhjes u refuzua ose ka skaduar.");
  const json = (await res.json()) as { token: string; refreshToken: string; expiresIn: number };
  await createAdminClient()
    .from("integration_tokens")
    .upsert({
      provider: "beds24",
      access_token: json.token,
      refresh_token: json.refreshToken,
      expires_at: new Date(Date.now() + (json.expiresIn - 300) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
}

/** Live availability and stay price for every room of the property. */
export async function getOffers(arrival: string, departure: string, adults: number): Promise<Map<number, RoomOffer>> {
  const propertyId = process.env.BEDS24_PROPERTY_ID;
  if (!propertyId) throw new Error("BEDS24_PROPERTY_ID is not set");
  const qs = new URLSearchParams({ propertyId, arrival, departure, numAdults: String(adults) });
  const json = await call<{ data: { roomId: number; offers?: { price: number; unitsAvailable: number }[] }[] }>(
    `/inventory/rooms/offers?${qs}`,
  );
  const map = new Map<number, RoomOffer>();
  for (const room of json.data ?? []) {
    const best = (room.offers ?? []).filter((o) => o.unitsAvailable > 0).sort((a, b) => a.price - b.price)[0];
    if (best) map.set(room.roomId, { roomId: room.roomId, price: best.price, unitsAvailable: best.unitsAvailable });
  }
  return map;
}

type WriteResult = { success: boolean; new?: { id: number }; modified?: Record<string, unknown>; errors?: unknown };

export async function upsertBooking(booking: Partial<B24Booking> & { id?: number }): Promise<number> {
  const out = await call<WriteResult[]>("/bookings", { method: "POST", body: JSON.stringify([booking]) });
  const r = out[0];
  if (!r?.success) throw new Error("Beds24 rejected the booking: " + JSON.stringify(r?.errors ?? r));
  return r.new?.id ?? (booking.id as number);
}

export async function getBooking(id: number): Promise<B24Booking | null> {
  const json = await call<{ data: B24Booking[] }>(`/bookings?id=${id}`);
  return json.data?.[0] ?? null;
}

export async function listModifiedBookings(modifiedFrom: string): Promise<B24Booking[]> {
  const propertyId = process.env.BEDS24_PROPERTY_ID;
  const qs = new URLSearchParams({ modifiedFrom });
  if (propertyId) qs.set("propertyId", propertyId);
  const json = await call<{ data: B24Booking[] }>(`/bookings?${qs}`);
  return json.data ?? [];
}

export type CalendarDay = { roomId: number; date: string; price: number | null; minStay: number | null };

/** Daily prices for all rooms of the property between two dates (inclusive). */
export async function getCalendarPrices(startDate: string, endDate: string): Promise<CalendarDay[]> {
  const propertyId = process.env.BEDS24_PROPERTY_ID;
  if (!propertyId) throw new Error("BEDS24_PROPERTY_ID is not set");
  const qs = new URLSearchParams({ propertyId, startDate, endDate, includePrices: "true", includeMinStay: "true" });
  const json = await call<{ data: { roomId: number; calendar: { from: string; to: string; price1?: number; minStay?: number }[] }[] }>(
    `/inventory/rooms/calendar?${qs}`,
  );
  const out: CalendarDay[] = [];
  for (const room of json.data ?? []) {
    for (const range of room.calendar ?? []) {
      for (let d = new Date(range.from + "T00:00:00Z"); d <= new Date(range.to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
        out.push({ roomId: room.roomId, date: d.toISOString().slice(0, 10), price: range.price1 ?? null, minStay: range.minStay ?? null });
      }
    }
  }
  return out;
}

/** Sets the nightly price (and optionally minimum stay) for rooms over a date range. Channels pick it up from here. */
export async function setPrices(roomIds: number[], from: string, to: string, price: number, minStay?: number) {
  const body = roomIds.map((roomId) => ({
    roomId,
    calendar: [{ from, to, price1: price, ...(minStay ? { minStay } : {}) }],
  }));
  const res = await call<{ success: boolean }[]>("/inventory/rooms/calendar", { method: "POST", body: JSON.stringify(body) });
  const failed = res.filter((r) => !r.success).length;
  if (failed) throw new Error(`${failed} njësi nuk u përditësuan`);
}

/** Keeps property check-in/out times and room names/capacity in line with what the owner sets in the panel. */
export async function updateProperty(patch: { checkInStart?: string; checkOutEnd?: string; rooms?: { id: number; name?: string; maxPeople?: number }[] }) {
  const propertyId = Number(process.env.BEDS24_PROPERTY_ID);
  if (!propertyId) throw new Error("BEDS24_PROPERTY_ID is not set");
  const body = [{
    id: propertyId,
    ...(patch.checkInStart ? { checkInStart: patch.checkInStart } : {}),
    ...(patch.checkOutEnd ? { checkOutEnd: patch.checkOutEnd } : {}),
    ...(patch.rooms ? { roomTypes: patch.rooms } : {}),
  }];
  const res = await call<{ success: boolean }[]>("/properties", { method: "POST", body: JSON.stringify(body) });
  if (!res[0]?.success) throw new Error("Kanalet nuk e pranuan ndryshimin");
}
