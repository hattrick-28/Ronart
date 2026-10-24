"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = {
  sq: ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const SHORT = {
  sq: ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Korr", "Gush", "Sht", "Tet", "Nën", "Dhj"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const WEEK = { sq: ["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"], en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const nights = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

function Month({ year, month, lang, today, start, end, hover, onPick, onHover }: {
  year: number; month: number; lang: "sq" | "en"; today: string; start: string | null; end: string | null; hover: string | null;
  onPick: (d: string) => void; onHover: (d: string | null) => void;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1))))];
  const rangeEnd = end ?? (start && hover && hover > start ? hover : null);
  return (
    <div className="w-full">
      <p className="text-center font-semibold mb-2">{MONTHS[lang][month]} {year}</p>
      <div className="grid grid-cols-7 text-center text-xs text-ink-3 mb-1">{WEEK[lang].map((w) => <span key={w}>{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const past = d < today;
          const isStart = d === start;
          const isEnd = d === rangeEnd;
          const inRange = start && rangeEnd && d > start && d < rangeEnd;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              aria-pressed={isStart || isEnd}
              className={`h-10 text-sm tabular-nums transition-colors
                ${past ? "text-ink-3/40 cursor-not-allowed" : "hover:bg-wall-soft"}
                ${inRange ? "bg-wall-soft rounded-none" : "rounded-full"}
                ${isStart || isEnd ? "!bg-wall-deep text-milk font-semibold rounded-full" : ""}
                ${d === today && !isStart ? "font-semibold underline underline-offset-4" : ""}`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ lang, today, checkIn, checkOut, labelIn, labelOut, tone = "plain" }: {
  lang: "sq" | "en"; today: string; checkIn: string; checkOut: string; labelIn: string; labelOut: string; tone?: "walnut" | "plain";
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(checkIn);
  const [end, setEnd] = useState<string | null>(checkOut);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => { const d = parse(checkIn); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  function pick(d: string) {
    if (!start || end || d <= start) { setStart(d); setEnd(null); return; }
    if (nights(start, d) > 30) return;
    setEnd(d);
    setOpen(false);
  }

  const next = useMemo(() => (view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }), [view]);
  const canPrev = view.y * 12 + view.m > parse(today).getUTCFullYear() * 12 + parse(today).getUTCMonth();
  const fmt = (s: string | null) => (s ? `${Number(s.slice(8))} ${SHORT[lang][Number(s.slice(5, 7)) - 1]}` : "—");
  const n = start && end ? nights(start, end) : 0;
  const labelCls = tone === "walnut" ? "text-walnut-soft" : "text-ink-2";
  const hint = !start || end ? (lang === "sq" ? "Zgjidh ditën e ardhjes" : "Pick your arrival day") : (lang === "sq" ? "Tani zgjidh ditën e largimit" : "Now pick your departure day");

  return (
    <div ref={box} className="relative col-span-2">
      <input type="hidden" name="in" value={start ?? ""} />
      <input type="hidden" name="out" value={end ?? (start ? addDays(start, 1) : "")} />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="grid grid-cols-2 w-full text-left gap-3">
        {[[labelIn, start], [labelOut, end]].map(([l, v], i) => (
          <span key={i} className="block">
            <span className={`block text-xs font-semibold mb-1.5 ${labelCls}`}>{l}</span>
            <span className="field flex items-center justify-between">
              <span className={v ? "" : "text-ink-3"}>{fmt(v as string | null)}</span>
              {i === 1 && n > 0 && <span className="text-xs text-ink-3">{n} {lang === "sq" ? (n === 1 ? "natë" : "netë") : n === 1 ? "night" : "nights"}</span>}
            </span>
          </span>
        ))}
      </button>
      {open && (
        <div className="absolute z-40 left-0 top-full mt-2 w-[min(42rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] bg-white text-ink border border-line shadow-[0_24px_48px_-16px_rgba(0,0,0,0.3)] p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!canPrev} onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} aria-label="Muaji i kaluar">‹</button>
            <p className="text-sm text-ink-2">{hint}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView(next)} aria-label="Muaji tjetër">›</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <Month year={view.y} month={view.m} lang={lang} today={today} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
            <div className="hidden sm:block">
              <Month year={next.y} month={next.m} lang={lang} today={today} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
