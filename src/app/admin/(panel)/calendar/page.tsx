import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/format";
import { CHANNEL_BAR, CHANNEL_LABEL } from "@/lib/labels";
import { nightsBetween } from "@/lib/pricing";

const WD = ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"];
const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const iso = /^\d{4}-\d{2}-\d{2}$/;

type View = "2w" | "month";

function monthStart(d: string) { return d.slice(0, 7) + "-01"; }
function monthDays(d: string) { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function shiftMonth(d: string, n: number) { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); }
const weekday = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const today = todayISO();
  const view: View = sp.view === "month" ? "month" : "2w";
  let start: string;
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) start = view === "month" ? `${sp.month}-01` : `${sp.month}-01`;
  else if (sp.from && iso.test(sp.from)) start = view === "month" ? monthStart(sp.from) : sp.from;
  else start = view === "month" ? monthStart(today) : addDays(today, -1);
  const DAYS = view === "month" ? monthDays(start) : 14;
  const end = addDays(start, DAYS);
  const prev = view === "month" ? shiftMonth(start, -1) : addDays(start, -14);
  const next = view === "month" ? shiftMonth(start, 1) : addDays(start, 14);
  const q = (from: string, v: View = view) => `/admin/calendar?view=${v}&from=${from}`;

  const supabase = await createClient();
  const [{ data: units }, { data: bookings }] = await Promise.all([
    supabase.from("units").select("id, name, type").eq("active", true).order("sort"),
    supabase.from("bookings")
      .select("id, unit_id, check_in, check_out, channel, status, guests(full_name)")
      .in("status", ["hold", "pending", "confirmed", "checked_in", "checked_out"])
      .lt("check_in", end).gt("check_out", start),
  ]);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const groups = [
    { label: "Suitat", items: (units ?? []).filter((u) => u.type === "suite") },
    { label: "Apartamentet", items: (units ?? []).filter((u) => u.type === "apartment") },
  ];
  const active = bookings ?? [];
  const freeOn = (d: string) =>
    (units ?? []).length -
    new Set(active.filter((b) => b.check_in <= d && b.check_out > d && ["hold", "pending", "confirmed", "checked_in"].includes(b.status)).map((b) => b.unit_id)).size;
  const colW = view === "month" ? "minmax(1.7rem,1fr)" : "minmax(3rem,1fr)";
  const gridCols = `${view === "month" ? "7.5rem" : "9rem"} repeat(${DAYS}, ${colW})`;
  const title = view === "month"
    ? `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`
    : `${Number(start.slice(8))} ${MONTHS[Number(start.slice(5, 7)) - 1].slice(0, 3)} – ${Number(addDays(end, -1).slice(8))} ${MONTHS[Number(addDays(end, -1).slice(5, 7)) - 1].slice(0, 3)} ${addDays(end, -1).slice(0, 4)}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-wall-deep">Kalendari</h1>
          <p className="text-ink-2 mt-0.5">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="Pamja">
            {([["2w", "2 javë"], ["month", "Muaji"]] as const).map(([v, l]) => (
              <Link key={v} href={q(v === "month" ? monthStart(start) : start, v)} aria-current={view === v ? "true" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${view === v ? "bg-wall-deep text-milk" : "text-ink-2 hover:text-ink"}`}>{l}</Link>
            ))}
          </div>
          <Link className="btn btn-ghost btn-sm" href={q(prev)} aria-label="Periudha e kaluar">‹</Link>
          <Link className="btn btn-ghost btn-sm" href={q(view === "month" ? monthStart(today) : addDays(today, -1))}>Sot</Link>
          <Link className="btn btn-ghost btn-sm" href={q(next)} aria-label="Periudha tjetër">›</Link>
          <form action="/admin/calendar" className="flex items-center gap-2">
            <input type="hidden" name="view" value={view} />
            <input className="field field-sm w-40" type={view === "month" ? "month" : "date"} name={view === "month" ? "month" : "from"}
              defaultValue={view === "month" ? start.slice(0, 7) : start} aria-label="Shko te data" />
            <button className="btn btn-primary btn-sm">Shko</button>
          </form>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-3 rounded-sm ${CHANNEL_BAR[k]}`} />{v}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-dashed border-ink-3" />Në pritje</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-white">
        <div style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: view === "month" ? "980px" : "900px" }} className="text-sm">
          {/* header */}
          <div className="sticky left-0 z-20 bg-white border-b border-line" />
          {days.map((d) => {
            const we = weekday(d) === 0 || weekday(d) === 6;
            return (
              <div key={d} className={`border-b border-l border-line py-1.5 text-center leading-tight ${d === today ? "bg-glow/30" : we ? "bg-milk-2" : ""}`}>
                <div className="text-[0.68rem] text-ink-3">{WD[weekday(d)]}</div>
                <div className={`text-sm ${d === today ? "font-bold" : "font-medium"}`}>{Number(d.slice(8))}</div>
                {(d.slice(8) === "01" || d === start) && <div className="text-[0.62rem] text-ink-3">{MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}</div>}
              </div>
            );
          })}

          {groups.map((g) => (
            <div key={g.label} className="contents">
              <div className="sticky left-0 z-10 bg-milk-2 border-b border-line px-3 py-1.5 text-xs font-semibold text-ink-2" style={{ gridColumn: "1 / 2" }}>{g.label}</div>
              <div className="bg-milk-2 border-b border-line" style={{ gridColumn: `2 / span ${DAYS}` }} />
              {g.items.map((u) => {
                const rows = active.filter((b) => b.unit_id === u.id);
                return (
                  <div key={u.id} className="contents">
                    <div className="sticky left-0 z-10 bg-white border-b border-line px-3 py-2 font-medium truncate">{u.name}</div>
                    <div className="relative border-b border-line" style={{ gridColumn: `span ${DAYS}` }}>
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0,1fr))` }}>
                        {days.map((d) => {
                          const we = weekday(d) === 0 || weekday(d) === 6;
                          const tone = d === today ? "bg-glow/15" : d < today ? "bg-milk-2/60" : we ? "bg-milk-2/50" : "";
                          return d >= today ? (
                            <Link key={d} href={`/admin/bookings/new?unit=${u.id}&in=${d}&out=${addDays(d, 1)}`}
                              title={`Rezervim i ri: ${u.name}, ${Number(d.slice(8))}`} aria-label={`Rezervim i ri për ${u.name} më ${d}`}
                              className={`border-l border-line hover:bg-wall-soft/80 ${tone}`} />
                          ) : (
                            <div key={d} className={`border-l border-line ${tone}`} />
                          );
                        })}
                      </div>
                      <div className="relative h-11 pointer-events-none">
                        {rows.map((b) => {
                          const s = b.check_in < start ? start : b.check_in;
                          const e = b.check_out > end ? end : b.check_out;
                          const half = 50 / DAYS;
                          const left = (nightsBetween(start, s) / DAYS) * 100 + (b.check_in < start ? 0 : half);
                          const right = (nightsBetween(start, e) / DAYS) * 100 + (b.check_out > end ? 0 : half);
                          const g2 = b.guests as unknown as { full_name: string } | null;
                          const n = nightsBetween(b.check_in, b.check_out);
                          return (
                            <Link key={b.id} href={`/admin/bookings/${b.id}`} title={`${g2?.full_name ?? ""} · ${CHANNEL_LABEL[b.channel]} · ${n} netë`}
                              className={`pointer-events-auto absolute top-1.5 bottom-1.5 rounded-md px-2 text-xs font-medium flex items-center gap-1 overflow-hidden whitespace-nowrap shadow-sm ${CHANNEL_BAR[b.channel]} ${b.status === "hold" || b.status === "pending" ? "opacity-70 outline-2 outline-dashed outline-white/80 -outline-offset-4" : ""} ${b.status === "checked_out" ? "opacity-45" : ""}`}
                              style={{ left: `${left}%`, width: `calc(${right - left}% - 2px)` }}>
                              <span className="truncate">{g2?.full_name ?? "—"}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* free units per night */}
          <div className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-semibold text-ink-2">Të lira</div>
          {days.map((d) => {
            const f = freeOn(d);
            return (
              <div key={d} className={`border-l border-line py-2 text-center text-xs font-semibold tabular-nums ${f === 0 ? "text-bad" : f <= 3 ? "text-warn" : "text-ok"}`}>{f}</div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-3">Kliko një kuti bosh për rezervim të ri në atë njësi dhe datë. Kliko një shirit për të hapur rezervimin. Shiritat fillojnë në mesditë të ditës së ardhjes dhe mbarojnë në mesditë të largimit.</p>
    </div>
  );
}
