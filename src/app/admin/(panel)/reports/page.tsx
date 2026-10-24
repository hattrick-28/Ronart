import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eur, todayISO } from "@/lib/format";
import { CHANNEL_LABEL, METHOD_LABEL } from "@/lib/labels";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff({ owner: true });
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayISO().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const supabase = await createClient();

  const [{ data: stays }, { data: pays }, { data: staff }] = await Promise.all([
    supabase.from("bookings").select("channel, total_amount, check_in, check_out")
      .in("status", ["confirmed", "checked_in", "checked_out"]).gte("check_in", start).lt("check_in", end),
    supabase.from("payments").select("amount, method, received_by, created_at")
      .eq("status", "succeeded").gte("created_at", `${start}T00:00:00+02:00`).lt("created_at", `${end}T00:00:00+02:00`),
    supabase.from("staff").select("user_id, full_name"),
  ]);

  const byChannel = new Map<string, { n: number; total: number }>();
  for (const s of stays ?? []) {
    const c = byChannel.get(s.channel) ?? { n: 0, total: 0 };
    c.n++; c.total += Number(s.total_amount);
    byChannel.set(s.channel, c);
  }
  const byMethod = new Map<string, number>();
  const cashByStaff = new Map<string, number>();
  for (const p of pays ?? []) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
    if (p.method === "cash" && p.received_by) cashByStaff.set(p.received_by, (cashByStaff.get(p.received_by) ?? 0) + Number(p.amount));
  }
  const commission = (byChannel.get("booking")?.total ?? 0) * 0.15;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-wall-deep">Raportet</h1>
        <form className="grid grid-cols-2 sm:grid-cols-[12rem_auto_auto] gap-2 items-end w-full sm:w-auto">
          <label className="col-span-2 sm:col-span-1"><span className="label">Muaji</span><input className="field" type="month" name="month" defaultValue={month} /></label>
          <button className="btn btn-ghost">Shfaq</button>
          <a className="btn btn-primary" href={`/admin/reports/export?month=${month}`} download>Shkarko Excel</a>
        </form>
      </div>
      <div className="mt-6 grid md:grid-cols-2 gap-5">
        <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
          <h2 className="font-display text-lg font-semibold">Rezervimet sipas kanalit</h2>
          <p className="text-xs text-ink-3">Sipas datës së ardhjes në këtë muaj</p>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {[...byChannel.entries()].map(([c, v]) => (
                <tr key={c}><td className="py-2">{CHANNEL_LABEL[c]}</td><td className="py-2 text-right text-ink-3">{v.n}</td><td className="py-2 text-right font-semibold">{eur(v.total)}</td></tr>
              ))}
              {byChannel.size === 0 && <tr><td className="py-2 text-ink-3">Asnjë rezervim.</td></tr>}
            </tbody>
          </table>
          {commission > 0 && <p className="mt-3 text-sm text-ink-2">Komisioni i pritur nga Booking.com (~15%): <b>{eur(commission)}</b>. Krahasoje me faturën mujore.</p>}
        </section>
        <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
          <h2 className="font-display text-lg font-semibold">Pagesat e marra</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {[...byMethod.entries()].map(([k, v]) => <tr key={k}><td className="py-2">{METHOD_LABEL[k]}</td><td className="py-2 text-right font-semibold">{eur(v)}</td></tr>)}
              {byMethod.size === 0 && <tr><td className="py-2 text-ink-3">Asnjë pagesë.</td></tr>}
            </tbody>
          </table>
          <h3 className="mt-5 font-semibold text-sm">Para në dorë sipas stafit</h3>
          <ul className="mt-2 text-sm space-y-1">
            {[...cashByStaff.entries()].map(([uid, v]) => (
              <li key={uid} className="flex justify-between"><span>{staff?.find((s) => s.user_id === uid)?.full_name ?? "—"}</span><b>{eur(v)}</b></li>
            ))}
            {cashByStaff.size === 0 && <li className="text-ink-3">Asnjë pagesë me para në dorë.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
