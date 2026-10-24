import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCalendarPrices, type CalendarDay } from "@/lib/beds24";
import { addDays, todayISO } from "@/lib/format";
import { Flash } from "@/components/admin/flash";
import { savePrices } from "../../actions";

const WD = ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"];
const DAYS = 14;

export default async function PricesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff({ owner: true });
  const sp = await searchParams;
  const start = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && sp.from >= todayISO() ? sp.from : todayISO();
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, name, type, base_price, beds24_room_id").eq("active", true).order("sort");

  let cal: CalendarDay[] = [];
  let calError = false;
  try {
    cal = await getCalendarPrices(start, days[DAYS - 1]);
  } catch {
    calError = true;
  }
  const priceOf = (roomId: number | null, date: string) => cal.find((c) => c.roomId === roomId && c.date === date)?.price ?? null;

  return (
    <div className="max-w-6xl">
      <Flash ok={sp.ok} err={sp.err} />
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Çmimet</h1>
      <p className="text-ink-2 mt-1">Çmimi që vendos këtu shkon në faqe, Booking.com dhe Airbnb njëkohësisht.</p>

      <form action={savePrices} className="mt-6 rounded-[var(--radius-panel)] bg-white border border-line p-5 space-y-5">
        <fieldset>
          <legend className="label">Për cilat njësi</legend>
          <div className="flex flex-wrap gap-2">
            {[["apartment", "Të gjitha apartamentet"], ["suite", "Të gjitha suitat"], ["selected", "Njësi të zgjedhura"]].map(([v, l], i) => (
              <label key={v} className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm has-[:checked]:bg-wall-deep has-[:checked]:text-milk has-[:checked]:border-wall-deep">
                <input type="radio" name="scope" value={v} defaultChecked={i === 0} className="sr-only" /> {l}
              </label>
            ))}
          </div>
          <details className="mt-3">
            <summary className="text-sm text-ink-2 cursor-pointer">Zgjidh njësitë (për “Njësi të zgjedhura”)</summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(units ?? []).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm rounded-lg border border-line px-3 py-2 has-[:checked]:border-wall has-[:checked]:bg-wall-soft/60">
                  <input type="checkbox" name="unit" value={u.id} /> {u.name}
                </label>
              ))}
            </div>
          </details>
        </fieldset>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <label><span className="label">Nga data</span><input className="field" type="date" name="from" min={todayISO()} defaultValue={start} required /></label>
          <label><span className="label">Deri në datën</span><input className="field" type="date" name="to" min={todayISO()} defaultValue={addDays(start, 30)} required /></label>
          <label><span className="label">Çmimi për natë (€)</span><input className="field" type="number" name="price" min={1} step="1" required placeholder="45" /></label>
          <label><span className="label">Min. netë (opsionale)</span><input className="field" type="number" name="minStay" min={1} max={30} placeholder="1" /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-3">Ndryshimi shkon menjëherë në faqe, Booking.com dhe Airbnb.</p>
          <button className="btn btn-primary">Ruaj çmimin</button>
        </div>
      </form>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Çmimet aktuale</h2>
          <div className="flex gap-2">
            {start > todayISO() && <a className="btn btn-ghost btn-sm" href={`/admin/prices?from=${addDays(start, -DAYS) < todayISO() ? todayISO() : addDays(start, -DAYS)}`}>Më parë</a>}
            <a className="btn btn-ghost btn-sm" href={`/admin/prices?from=${addDays(start, DAYS)}`}>Më pas</a>
          </div>
        </div>
        {calError ? (
          <p className="mt-3 rounded-[var(--radius-field)] bg-warn-soft text-warn px-4 py-3 text-sm">Çmimet nuk u lexuan dot nga kanalet tani. Provo pas pak.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-white">
            <table className="w-full text-sm min-w-[860px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="sticky left-0 bg-white text-left font-medium px-3 py-2 w-36">Njësia</th>
                  {days.map((d) => (
                    <th key={d} className="font-medium px-1 py-2 text-center">
                      <div className="text-xs">{WD[new Date(d + "T00:00:00Z").getUTCDay()]}</div>
                      <div className="text-ink">{Number(d.slice(8))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(units ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium whitespace-nowrap">{u.name}</td>
                    {days.map((d) => {
                      const p = priceOf(u.beds24_room_id, d);
                      return <td key={d} className={`px-1 py-2 text-center ${p === null ? "text-ink-3" : ""}`}>{p === null ? "–" : `${p}`}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
