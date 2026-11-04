import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/site/arrow";
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
    <div className="s-wrap s-cv on-light">
      <Link href={`/rooms?in=${checkIn}&out=${checkOut}&guests=${guests}`} className="s-linkbtn"><Arrow back />{d.back_rooms}</Link>
      <h1>{d.book_title}</h1>
      <div className="s-bk">
        <div>
          <p className="s-hold"><i aria-hidden="true" />{t(d.hold_info, { min: s.hold_minutes })}</p>
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
        </div>
        <aside className="s-bill" aria-label={d.summary}>
          <div className="s-bill__img">
            <Image src={`/rooms/${unit.type}.jpg`} alt="" width={1536} height={1024} sizes="(min-width: 1080px) 390px, 100vw" />
            <p>{unit.name}</p>
          </div>
          <span className="s-seam__line" aria-hidden="true" />
          <div className="s-bill__body">
            <dl>
              <div><dt>{d.arrival}</dt><dd>{shortDate(checkIn, lang)}, {s.check_in_time}</dd></div>
              <div><dt>{d.departure}</dt><dd>{shortDate(checkOut, lang)}, {s.check_out_time}</dd></div>
              <div><dt>{d.guests}</dt><dd>{guests}</dd></div>
              <div><dt>{unit.type === "suite" ? d.suite : d.apartment}</dt><dd>{d.up_to} {unit.max_guests} {d.people}</dd></div>
              <div className="total"><dt>{d.total_for} {nights} {nights === 1 ? d.night : d.nights}</dt><dd>{eur(q.total)}</dd></div>
              <div><dt>{d.pay_full}</dt><dd>{eur(q.fullNow)}</dd></div>
              <div><dt>{d.pay_deposit}</dt><dd>{eur(q.depositNow)}</dd></div>
            </dl>
            <div className="s-pol">
              <span>{d.f_checkin} {s.check_in_time}</span>
              <span>{d.f_cancel_a} {s.free_cancellation_days} {d.f_cancel_b}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
