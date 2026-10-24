import { redirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { dict, getLang, t } from "@/lib/i18n";
import { searchAvailability } from "@/lib/availability";
import { nightsBetween, quote } from "@/lib/pricing";
import { eur, shortDate, todayISO } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Rezervo", robots: { index: false } };

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const d = dict[lang];
  const { unit: unitId, in: checkIn, out: checkOut } = sp;
  const guests = Math.min(3, Math.max(1, Number(sp.guests) || 2));
  if (!unitId || !checkIn || !checkOut || !isoRe.test(checkIn) || !isoRe.test(checkOut) || checkIn < todayISO()) redirect("/rooms");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > 30) redirect("/rooms");

  let unit;
  try {
    unit = (await searchAvailability(checkIn, checkOut, guests)).find((u) => u.id === unitId);
  } catch {
    redirect(`/rooms?in=${checkIn}&out=${checkOut}&guests=${guests}`);
  }
  if (!unit || !unit.available) redirect(`/rooms?in=${checkIn}&out=${checkOut}&guests=${guests}`);

  const s = await getSettings();
  const q = quote(unit.stayPrice / nights, nights, s.full_payment_discount_pct, unit.stayPrice);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-wall-deep">{d.book_title}</h1>
      <div className="mt-6 sm:mt-8 grid lg:grid-cols-[1fr_22rem] gap-10 items-start">
        <BookingForm
          lang={lang}
          d={d}
          unitId={unit.id}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          quote={q}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        />
        <aside className="order-first lg:order-none lg:sticky lg:top-24 rounded-[var(--radius-panel)] overflow-hidden border border-line bg-white">
          <Image src={`/rooms/${unit.type}.jpg`} alt="" width={1536} height={1024} sizes="(min-width: 1024px) 22rem, 100vw" className="hidden lg:block aspect-[3/2] object-cover" />
          <div className="p-5">
            <p className="font-display text-xl font-semibold">{unit.name}</p>
            <p className="text-sm text-ink-3">{unit.type === "suite" ? d.suite : d.apartment}, {d.up_to} {unit.max_guests} {d.people}</p>
            <dl className="mt-4 text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-ink-2">{d.arrival}</dt><dd>{shortDate(checkIn, lang)}, {s.check_in_time}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">{d.departure}</dt><dd>{shortDate(checkOut, lang)}, {s.check_out_time}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">{d.guests}</dt><dd>{guests}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="text-ink-2">{d.total_for} {nights} {nights === 1 ? d.night : d.nights}</dt><dd className="font-semibold">{eur(q.total)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-ink-3">{t(d.how_hold, { min: s.hold_minutes })}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
