import type { Metadata } from "next";
import { dict, getLang, t } from "@/lib/i18n";
import { SearchBar } from "@/components/search-bar";
import { listUnits, searchAvailability, type UnitAvailability, type Unit } from "@/lib/availability";
import { nightsBetween } from "@/lib/pricing";
import { todayISO } from "@/lib/format";
import { RoomBoard, type BoardGroup } from "@/components/site/room-board";

export const metadata: Metadata = { title: "Dhomat" };

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const d = dict[lang];
  const checkIn = sp.in && isoRe.test(sp.in) ? sp.in : undefined;
  const checkOut = sp.out && isoRe.test(sp.out) ? sp.out : undefined;
  const guests = Math.min(3, Math.max(1, Number(sp.guests) || 2));
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const validDates = Boolean(checkIn && checkOut && nights >= 1 && nights <= 30 && checkIn >= todayISO());

  let results: UnitAvailability[] | null = null;
  let units: Unit[] = [];
  let loadError = false;
  if (validDates) {
    try {
      results = await searchAvailability(checkIn!, checkOut!, guests);
    } catch (e) {
      console.error(e);
      loadError = true;
      units = await listUnits();
    }
  } else {
    units = await listUnits();
  }

  const source = results ?? units.map((u) => ({ ...u, available: false, stayPrice: u.base_price }));
  const nightsLabel = `${nights} ${nights === 1 ? d.night : d.nights}`;
  const freeCount = results ? results.filter((r) => r.available).length : 0;

  const groups: BoardGroup[] = (["suite", "apartment"] as const).map((type) => {
    const items = source.filter((u) => u.type === type);
    const size = items.find((u) => u.size_m2)?.size_m2;
    const maxG = items.length ? Math.max(...items.map((u) => u.max_guests)) : 0;
    const from = items.length ? Math.min(...items.map((u) => u.base_price)) : 0;
    const freeHere = results ? items.filter((u) => u.available).length : null;
    const spec: [string, string][] = [];
    if (size) spec.push([d.spec_size, `${size} m²`]);
    spec.push([d.spec_cap, `${d.up_to} ${maxG}`]);
    spec.push([d.from, `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(from)} ${d.per_night}`]);
    if (freeHere !== null) spec.push([d.available, t(d.free_of, { a: freeHere, b: items.length })]);
    return {
      type,
      title: type === "suite" ? (lang === "sq" ? "Suitat" : "Suites") : (lang === "sq" ? "Apartamentet" : "Apartments"),
      desc: (lang === "sq" ? items[0]?.description_sq : items[0]?.description_en) ?? null,
      img: `/rooms/${type}.jpg`,
      spec,
      units: items.map((u) => ({
        id: u.id, code: u.code, name: u.name, type: u.type, max_guests: u.max_guests, size_m2: u.size_m2,
        has_balcony: u.has_balcony, available: u.available, price: results ? u.stayPrice : u.base_price,
      })),
    };
  });

  return (
    <div className="s-wrap on-light">
      <div className="s-rv__head">
        <h1>{d.rooms_h}</h1>
        <p className="muted">{d.rooms_p}</p>
      </div>
      <SearchBar d={d} lang={lang} today={todayISO()} checkIn={checkIn} checkOut={checkOut} guests={guests} variant="plain" />
      {!validDates && <p className="s-qsum">{d.choose_dates}</p>}
      {results && freeCount > 0 && (
        <p className="s-qsum" aria-live="polite"><strong>{freeCount}</strong> {t(d.rooms_free, { n: "", nights: nightsLabel }).trim()}</p>
      )}
      {loadError && (
        <p className="s-note s-note--warn">
          {lang === "sq"
            ? "Nuk mund të kontrollojmë disponueshmërinë tani. Provo përsëri pas pak ose na telefono."
            : "We can't check availability right now. Try again shortly or call us."}
        </p>
      )}
      {results && freeCount === 0 && <p className="s-note s-note--bad">{d.no_rooms}</p>}
      <RoomBoard d={d} groups={groups} guests={guests} nightsLabel={nightsLabel}
        search={results ? { in: checkIn!, out: checkOut!, guests } : null} />
    </div>
  );
}
