import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { dict, getLang } from "@/lib/i18n";
import { SearchBar } from "@/components/search-bar";
import { listUnits, searchAvailability, type UnitAvailability, type Unit } from "@/lib/availability";
import { nightsBetween } from "@/lib/pricing";
import { eur, shortDate, todayISO } from "@/lib/format";

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
    }
  } else {
    units = await listUnits();
  }

  const groups = (["suite", "apartment"] as const).map((type) => ({
    type,
    items: (results ?? units.map((u) => ({ ...u, available: true, stayPrice: u.base_price }))).filter((u) => u.type === type),
  }));
  const anyFree = results?.some((r) => r.available);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-display text-4xl font-semibold text-wall-deep">{d.rooms_title}</h1>
      <div className="mt-6 rounded-[var(--radius-panel)] bg-white border border-line p-4 sm:p-5">
        <SearchBar d={d} lang={lang} checkIn={checkIn} checkOut={checkOut} guests={guests} tone="plain" />
      </div>

      {!validDates && <p className="mt-6 text-ink-2">{d.choose_dates}</p>}
      {loadError && (
        <p className="mt-6 rounded-[var(--radius-field)] bg-warn-soft text-warn px-4 py-3">
          {lang === "sq"
            ? "Nuk mund të kontrollojmë disponueshmërinë tani. Provo përsëri pas pak ose na telefono."
            : "We can't check availability right now. Try again shortly or call us."}
        </p>
      )}
      {results && !anyFree && <p className="mt-6 rounded-[var(--radius-field)] bg-plum-soft text-plum px-4 py-3">{d.no_rooms}</p>}

      {groups.map(({ type, items }) => (
        <section key={type} className="mt-12">
          <div className="flex items-end gap-6">
            <Image src={`/rooms/${type}.jpg`} alt="" width={240} height={160} className="hidden sm:block w-40 rounded-xl object-cover aspect-[3/2]" />
            <div>
              <h2 className="font-display text-2xl font-semibold">{type === "suite" ? (lang === "sq" ? "Suitat" : "Suites") : (lang === "sq" ? "Apartamentet" : "Apartments")}</h2>
              <p className="text-ink-2 mt-1 max-w-[60ch]">{lang === "sq" ? items[0]?.description_sq : items[0]?.description_en}</p>
            </div>
          </div>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {items
              .slice()
              .sort((a, b) => Number(b.available) - Number(a.available))
              .map((u) => (
                <li key={u.id} className={`py-4 grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_auto] gap-x-6 gap-y-1 items-center ${u.available ? "" : "opacity-55"}`}>
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-ink-3">
                      {d.up_to} {u.max_guests} {d.people}
                      {u.size_m2 ? `, ${u.size_m2} m²` : ""}
                      {u.has_balcony ? `, ${d.balcony.toLowerCase()}` : ""}
                    </p>
                  </div>
                  <div className="text-sm sm:text-base row-start-2 sm:row-start-auto">
                    {results ? (
                      u.available ? (
                        <span>
                          <span className="font-semibold">{eur(u.stayPrice)}</span>{" "}
                          <span className="text-ink-3">{d.total_for.toLowerCase()} {nights} {nights === 1 ? d.night : d.nights}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">{d.unavailable}</span>
                      )
                    ) : (
                      <span><span className="font-semibold">{eur(u.base_price)}</span> <span className="text-ink-3">{d.per_night}</span></span>
                    )}
                  </div>
                  <div className="row-span-2 sm:row-span-1 justify-self-end">
                    {results && u.available ? (
                      <Link className="btn btn-primary btn-sm" href={`/book?unit=${u.id}&in=${checkIn}&out=${checkOut}&guests=${guests}`}>
                        {d.choose}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {validDates && (
        <p className="mt-8 text-sm text-ink-3">
          {shortDate(checkIn!, lang)} – {shortDate(checkOut!, lang)}
        </p>
      )}
    </div>
  );
}
