import type { Dict, Lang } from "@/lib/i18n";
import { addDays, todayISO } from "@/lib/format";
import { DateRangePicker } from "./date-range-picker";

export function SearchBar({ d, lang, checkIn, checkOut, guests, tone = "walnut" }: {
  d: Dict; lang: Lang; checkIn?: string; checkOut?: string; guests?: number; tone?: "walnut" | "plain";
}) {
  const today = todayISO();
  const ci = checkIn ?? addDays(today, 1);
  const co = checkOut ?? addDays(ci, 2);
  const labelCls = tone === "walnut" ? "text-walnut-soft" : "text-ink-2";
  return (
    <form action="/rooms" method="get" className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_5.5rem_auto] gap-3 items-end">
      <DateRangePicker lang={lang} today={today} checkIn={ci} checkOut={co} labelIn={d.arrival} labelOut={d.departure} tone={tone} />
      <label className="block col-span-2 sm:col-span-1">
        <span className={`block text-xs font-semibold mb-1.5 ${labelCls}`}>{d.guests}</span>
        <select className="field" name="guests" defaultValue={String(guests ?? 2)}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button className={`btn col-span-2 sm:col-span-1 ${tone === "walnut" ? "btn-glow" : "btn-primary"}`}>{d.search}</button>
    </form>
  );
}
