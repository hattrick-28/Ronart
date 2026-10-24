import type { Dict } from "@/lib/i18n";
import { addDays, todayISO } from "@/lib/format";

export function SearchBar({ d, checkIn, checkOut, guests, tone = "walnut" }: {
  d: Dict; checkIn?: string; checkOut?: string; guests?: number; tone?: "walnut" | "plain";
}) {
  const today = todayISO();
  const ci = checkIn ?? addDays(today, 1);
  const co = checkOut ?? addDays(ci, 2);
  const labelCls = tone === "walnut" ? "text-walnut-soft" : "text-ink-2";
  return (
    <form action="/rooms" method="get" className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_5.5rem_auto] gap-3 items-end">
      <label className="block">
        <span className={`block text-xs font-semibold mb-1.5 ${labelCls}`}>{d.arrival}</span>
        <input className="field" type="date" name="in" defaultValue={ci} min={today} required />
      </label>
      <label className="block">
        <span className={`block text-xs font-semibold mb-1.5 ${labelCls}`}>{d.departure}</span>
        <input className="field" type="date" name="out" defaultValue={co} min={addDays(today, 1)} required />
      </label>
      <label className="block col-span-2 sm:col-span-1">
        <span className={`block text-xs font-semibold mb-1.5 ${labelCls}`}>{d.guests}</span>
        <select className="field" name="guests" defaultValue={String(guests ?? 2)}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button className={`btn col-span-2 sm:col-span-1 h-[46px] whitespace-nowrap ${tone === "walnut" ? "btn-glow" : "btn-primary"}`}>{d.search}</button>
    </form>
  );
}
