import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/format";
import { CHANNEL_BAR, CHANNEL_LABEL } from "@/lib/labels";
import { nightsBetween } from "@/lib/pricing";

const DAYS = 14;
const WD = ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const start = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : todayISO();
  const end = addDays(start, DAYS);
  const supabase = await createClient();
  const [{ data: units }, { data: bookings }] = await Promise.all([
    supabase.from("units").select("id, name, type").eq("active", true).order("sort"),
    supabase.from("bookings")
      .select("id, unit_id, check_in, check_out, channel, status, guests(full_name)")
      .in("status", ["hold", "pending", "confirmed", "checked_in", "checked_out"])
      .lt("check_in", end).gt("check_out", start),
  ]);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const today = todayISO();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-wall-deep">Kalendari</h1>
        <div className="flex gap-2">
          <Link className="btn btn-ghost !py-2" href={`/admin/calendar?from=${addDays(start, -DAYS)}`}>Më parë</Link>
          <Link className="btn btn-ghost !py-2" href="/admin/calendar">Sot</Link>
          <Link className="btn btn-ghost !py-2" href={`/admin/calendar?from=${end}`}>Më pas</Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-2">
        {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-3 rounded-sm ${CHANNEL_BAR[k]}`} />{v}</span>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-white">
        <div className="min-w-[900px]" style={{ display: "grid", gridTemplateColumns: `8rem repeat(${DAYS}, minmax(0,1fr))` }}>
          <div className="sticky left-0 bg-white border-b border-line" />
          {days.map((d) => {
            const wd = WD[new Date(d + "T00:00:00Z").getUTCDay()];
            return (
              <div key={d} className={`border-b border-l border-line px-1 py-2 text-center text-xs ${d === today ? "bg-glow/25 font-semibold" : ""}`}>
                <div className="text-ink-3">{wd}</div><div>{Number(d.slice(8))}</div>
              </div>
            );
          })}
          {(units ?? []).map((u) => {
            const rows = (bookings ?? []).filter((b) => b.unit_id === u.id);
            return (
              <div key={u.id} className="contents">
                <div className="sticky left-0 z-10 bg-white border-b border-line px-3 py-2 text-sm font-medium truncate">{u.name}</div>
                <div className="relative border-b border-line" style={{ gridColumn: `span ${DAYS}` }}>
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0,1fr))` }}>
                    {days.map((d) => <div key={d} className={`border-l border-line ${d === today ? "bg-glow/10" : ""}`} />)}
                  </div>
                  <div className="relative h-10">
                    {rows.map((b) => {
                      const s = b.check_in < start ? start : b.check_in;
                      const e = b.check_out > end ? end : b.check_out;
                      const left = (nightsBetween(start, s) / DAYS) * 100;
                      const width = (nightsBetween(s, e) / DAYS) * 100;
                      const g = b.guests as unknown as { full_name: string } | null;
                      return (
                        <Link
                          key={b.id}
                          href={`/admin/bookings/${b.id}`}
                          title={`${g?.full_name ?? ""} · ${CHANNEL_LABEL[b.channel]}`}
                          className={`absolute top-1.5 bottom-1.5 rounded-md px-2 text-xs font-medium flex items-center truncate ${CHANNEL_BAR[b.channel]} ${b.status === "hold" || b.status === "pending" ? "opacity-60 border-2 border-dashed border-white/70" : ""} ${b.status === "checked_out" ? "opacity-40" : ""}`}
                          style={{ left: `calc(${left}% + ${b.check_in < start ? 0 : 50 / DAYS}%)`, width: `calc(${width}% )` }}
                        >
                          {g?.full_name ?? "—"}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-3">Shiritat me vija: në pritje të pagesës ose konfirmimit. Shiritat fillojnë në mesditë të ditës së ardhjes.</p>
    </div>
  );
}
