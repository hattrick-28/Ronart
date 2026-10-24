import Image from "next/image";
import Link from "next/link";
import { dict, getLang, t } from "@/lib/i18n";
import { SearchBar } from "@/components/search-bar";
import { listUnits } from "@/lib/availability";
import { eur } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export default async function Home() {
  const lang = await getLang();
  const d = dict[lang];
  const units = await listUnits();
  const minPrice = (type: "apartment" | "suite") =>
    Math.min(...units.filter((u) => u.type === type).map((u) => u.base_price));
  const count = (type: "apartment" | "suite") => units.filter((u) => u.type === type).length;
  const s = await getSettings();

  return (
    <>
      {/* The headboard wall */}
      <section aria-label="Ronart Apartments">
        <div className="wall-texture text-milk">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-end">
            <div>
              <h1 className="font-display font-semibold text-[2.4rem] leading-[1.04] sm:text-[3.6rem] max-w-[14ch]">
                {d.hero_title}
              </h1>
              <p className="mt-5 text-milk/80 text-lg max-w-[42ch]">{d.hero_sub}</p>
            </div>
            <div className="relative z-20 hidden lg:block">
              <Image
                src="/rooms/suite.jpg"
                alt={lang === "sq" ? "Suita me dritare të mëdha dhe mur të gjelbër" : "Suite with large windows and a green wall"}
                width={1536}
                height={1024}
                priority
                className="rounded-[var(--radius-panel)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/10"
              />
            </div>
          </div>
        </div>
        <div className="glow-strip relative z-10" />
        <div className="walnut">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-7">
            <div className="max-w-3xl"><SearchBar d={d} /></div>
          </div>
        </div>
      </section>

      {/* Two kinds of rooms */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-16">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-wall-deep">{d.rooms_title}</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          {(["suite", "apartment"] as const).map((type) => (
            <Link key={type} href="/rooms" className="group block">
              <div className="overflow-hidden rounded-[var(--radius-panel)] bg-milk-2">
                <Image
                  src={`/rooms/${type}.jpg`}
                  alt={type === "suite" ? d.suite : d.apartment}
                  width={1536}
                  height={1024}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="aspect-[3/2] object-cover group-hover:scale-[1.015] transition-transform duration-500"
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold">
                  {count(type)} {type === "suite" ? (lang === "sq" ? "suita" : "suites") : (lang === "sq" ? "apartamente" : "apartments")}
                </h3>
                <p className="text-ink-2 whitespace-nowrap">
                  {d.from} <span className="font-semibold text-ink">{eur(minPrice(type))}</span> {d.per_night}
                </p>
              </div>
              <p className="mt-1.5 text-ink-2 max-w-[52ch]">
                {type === "suite"
                  ? lang === "sq" ? "Dritare nga dyshemeja deri në tavan, ballkon, deri në 3 persona." : "Floor-to-ceiling windows, a balcony, up to 3 guests."
                  : lang === "sq" ? "Krevat dopio, mur i gjelbër, dru arre. Për 2 persona." : "Double bed, green wall, walnut wood. For 2 guests."}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How booking works: two real choices */}
      <section id="how" className="bg-milk-2 border-y border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-wall-deep">{d.how_title}</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-5">
            <div className="rounded-[var(--radius-panel)] bg-wall-deep text-milk p-7">
              <p className="font-display text-xl font-semibold">{d.how_full_t}</p>
              <p className="mt-2 text-milk/80">{t(d.how_full_d, { pct: s.full_payment_discount_pct })}</p>
            </div>
            <div className="rounded-[var(--radius-panel)] bg-white border border-line p-7">
              <p className="font-display text-xl font-semibold">{d.how_dep_t}</p>
              <p className="mt-2 text-ink-2">{d.how_dep_d}</p>
            </div>
          </div>
          <div className="mt-6 grid md:grid-cols-2 gap-x-10 gap-y-2 text-ink-2 text-[0.95rem] max-w-5xl">
            <p>{t(d.how_hold, { min: s.hold_minutes })}</p>
            <p>{t(d.how_cancel, { days: s.free_cancellation_days })}</p>
          </div>
        </div>
      </section>
    </>
  );
}
