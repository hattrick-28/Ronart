import "server-only";
import { createAdminClient } from "./supabase/admin";
import { createPublicClient } from "./supabase/public";
import { beds24Connected, getFromPrices, getOffers } from "./beds24";
import { todayISO } from "./format";
import { nightsBetween } from "./pricing";

export type Unit = {
  id: string;
  code: string;
  name: string;
  type: "apartment" | "suite";
  description_sq: string | null;
  description_en: string | null;
  max_guests: number;
  beds: string | null;
  size_m2: number | null;
  has_balcony: boolean;
  base_price: number;
  photos: string[];
  beds24_room_id: number | null;
};

export type UnitAvailability = Unit & { available: boolean; stayPrice: number };

export const UNIT_COLUMNS =
  "id, code, name, type, description_sq, description_en, max_guests, beds, size_m2, has_balcony, base_price, photos, beds24_room_id";

const DEMO = process.env.DEMO_DATA === "1";

function demoUnits(): Unit[] {
  const ap = Array.from({ length: 13 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`, code: `AP${String(i + 1).padStart(2, "0")}`,
    name: `Apartamenti ${i + 1}`, type: "apartment" as const,
    description_sq: "Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.",
    description_en: "A warm apartment with a textured green feature wall, walnut wood and soft light.",
    max_guests: 2, beds: "1 krevat dopio", size_m2: 28, has_balcony: (i + 1) % 3 === 0, base_price: 45, photos: [], beds24_room_id: null,
  }));
  const su = Array.from({ length: 5 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, "0")}`, code: `SU${i + 1}`,
    name: `Suita ${i + 1}`, type: "suite" as const,
    description_sq: "Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.",
    description_en: "A spacious suite with floor-to-ceiling windows, balcony and a sitting area.",
    max_guests: 3, beds: "1 krevat king + divan", size_m2: 38, has_balcony: true, base_price: 60, photos: [], beds24_room_id: null,
  }));
  return [...ap, ...su];
}

export async function listUnits(): Promise<Unit[]> {
  if (DEMO) return demoUnits();
  const { data } = await createPublicClient()
    .from("units")
    .select(UNIT_COLUMNS)
    .eq("active", true)
    .order("sort");
  const units = (data ?? []).map((u) => ({ ...u, base_price: Number(u.base_price) })) as Unit[];
  // Show the live "from" price (same source as Booking.com/Airbnb); fall back to the stored price.
  try {
    if (await beds24Connected()) {
      const live = await getFromPrices(todayISO());
      for (const u of units) {
        const p = u.beds24_room_id ? live.get(u.beds24_room_id) : undefined;
        if (p) u.base_price = p;
      }
    }
  } catch (e) {
    console.error("live from-prices unavailable, using stored prices", e);
  }
  return units;
}

/**
 * Availability = free in our database AND (when connected) offered by Beds24,
 * which also reflects Booking.com and Airbnb. Throws if Beds24 can't be reached,
 * so a booking is never taken on stale data.
 */
export async function searchAvailability(checkIn: string, checkOut: string, guests: number): Promise<UnitAvailability[]> {
  const nights = nightsBetween(checkIn, checkOut);
  if (DEMO) {
    return demoUnits().map((u, i) => ({ ...u, available: i % 4 !== 1 && u.max_guests >= guests, stayPrice: u.base_price * nights }));
  }
  const db = createAdminClient();
  await db.rpc("expire_stale_bookings");
    const [units, taken] = await Promise.all([
    listUnits(),
    db.from("bookings")
      .select("unit_id")
      .in("status", ["hold", "pending", "confirmed", "checked_in"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn),
  ]);
  const takenIds = new Set((taken.data ?? []).map((r) => r.unit_id));

  const offers = (await beds24Connected()) ? await getOffers(checkIn, checkOut, Math.max(1, guests)) : null;

  return units.map((u) => {
    const offer = offers && u.beds24_room_id ? offers.get(u.beds24_room_id) : undefined;
    const freeLocally = !takenIds.has(u.id) && u.max_guests >= guests;
    const available = offers ? freeLocally && Boolean(offer) : freeLocally;
    return { ...u, available, stayPrice: offer?.price ?? u.base_price * nights };
  });
}
