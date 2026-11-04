"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { Arrow, Fill } from "./site/arrow";

const MONTHS = {
  sq: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEK = { sq: ["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"], en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] };
const WEEK_LONG = {
  sq: ["e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë", "e diel"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
const MAX_NIGHTS = 30;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const nights = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const dow = (s: string) => (parse(s).getUTCDay() + 6) % 7;

function label(s: string | null, lang: Lang, d: Dict) {
  if (!s) return d.pick_date;
  const x = parse(s);
  return `${WEEK[lang][dow(s)]}, ${x.getUTCDate()} ${MONTHS[lang][x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
}
const nightWord = (n: number, d: Dict) => `${n} ${n === 1 ? d.night : d.nights}`;

export function SearchBar({ d, lang, today, checkIn, checkOut, guests = 2, variant = "hero" }: {
  d: Dict; lang: Lang; today: string; checkIn?: string; checkOut?: string; guests?: number; variant?: "hero" | "plain";
}) {
  const [start, setStart] = useState<string | null>(checkIn ?? addDays(today, 1));
  const [end, setEnd] = useState<string | null>(checkOut ?? addDays(checkIn ?? addDays(today, 1), 2));
  const [g, setG] = useState(guests);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const t0 = parse(start ?? today);
  const [view, setView] = useState({ y: t0.getUTCFullYear(), m: t0.getUTCMonth() });
  const opener = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const tm = parse(today);
  const canPrev = view.y > tm.getUTCFullYear() || (view.y === tm.getUTCFullYear() && view.m > tm.getUTCMonth());
  const next = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };

  const openAt = (b: HTMLButtonElement) => {
    opener.current = b;
    if (start) { const s = parse(start); setView({ y: s.getUTCFullYear(), m: s.getUTCMonth() }); }
    setOpen(true);
  };
  const close = useCallback(() => { setOpen(false); setHover(null); opener.current?.focus({ preventScroll: true }); }, []);

  // place the popover under the bar (or above it when there is no room); phones get a bottom sheet from CSS
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !opener.current || !el) return;
    if (window.innerWidth > 720) {
      const r = opener.current.closest("form")!.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      let top = r.bottom + 10;
      if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 10);
      el.style.left = `${Math.min(Math.max(16, r.left), window.innerWidth - w - 16)}px`;
      el.style.top = `${top}px`;
    }
    el.style.visibility = "visible";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("rn:lock", { detail: true }));
    const f = pop.current?.querySelector<HTMLButtonElement>(".s-day.is-start") ?? pop.current?.querySelector<HTMLButtonElement>(".s-day:not(:disabled)");
    f?.focus();
    return () => { window.dispatchEvent(new CustomEvent("rn:lock", { detail: false })); };
  }, [open]);

  function pick(day: string) {
    if (!start || end || day <= start) { setStart(day); setEnd(null); return; }
    if (nights(start, day) > MAX_NIGHTS) { setStart(day); setEnd(null); return; }
    setEnd(day);
    if (window.innerWidth <= 720) setTimeout(close, 380);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab" && pop.current) {
      const f = [...pop.current.querySelectorAll<HTMLElement>("button:not(:disabled)")].filter((x) => x.offsetParent);
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      return;
    }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    const cur = (document.activeElement as HTMLElement)?.dataset?.day;
    if (!step || !cur) return;
    e.preventDefault();
    const nk = addDays(cur, step);
    if (nk < today) return;
    const nd = parse(nk);
    const inView = (nd.getUTCFullYear() === view.y && nd.getUTCMonth() === view.m) ||
      (window.innerWidth > 720 && nd.getUTCFullYear() === next.y && nd.getUTCMonth() === next.m);
    if (!inView) setView({ y: nd.getUTCFullYear(), m: nd.getUTCMonth() });
    requestAnimationFrame(() => pop.current?.querySelector<HTMLButtonElement>(`[data-day="${nk}"]`)?.focus());
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    if (!start || !end) { e.preventDefault(); openAt(e.currentTarget.querySelector<HTMLButtonElement>("[data-open]")!); }
  }

  const n = start && end ? nights(start, end) : 0;
  const hint = !start || end ? (end ? d.cal_chosen.replace("{n}", nightWord(n, d)) : d.cal_in) : d.cal_out;

  return (
    <>
      <form action="/rooms" method="get" onSubmit={submit} className={`s-bar${variant === "plain" ? " s-bar--plain" : ""}`} data-intro={variant === "hero" ? "" : undefined}>
        <input type="hidden" name="in" value={start ?? ""} />
        <input type="hidden" name="out" value={end ?? ""} />
        <input type="hidden" name="guests" value={g} />
        <div className="s-bar__dates">
          {([[d.arrival, start], [d.departure, end]] as const).map(([l, v], i) => (
            <button key={i} type="button" className="s-bar__f" data-open aria-haspopup="dialog" aria-expanded={open}
              onClick={(e) => openAt(e.currentTarget)}>
              <span className="s-bar__l">{l}</span>
              <span className="s-bar__v">{label(v, lang, d)}</span>
            </button>
          ))}
        </div>
        <div className="s-bar__g">
          <span>
            <span className="s-bar__l">{d.guests}</span>
            <span className="small muted">{n ? nightWord(n, d) : " "}</span>
          </span>
          <span className="s-stepper" role="group" aria-label={d.guests}>
            <button type="button" aria-label={d.less_guest} disabled={g <= 1} onClick={() => setG((x) => Math.max(1, x - 1))}>−</button>
            <output aria-live="polite">{g}</output>
            <button type="button" aria-label={d.more_guest} disabled={g >= 3} onClick={() => setG((x) => Math.min(3, x + 1))}>+</button>
          </span>
        </div>
        <button type="submit" className="s-btn s-btn--dark s-bar__go" data-fill><Fill />{d.search}<Arrow /></button>
      </form>

      {open && (
        <>
          <div className="s-scrim" onClick={close} />
          <div ref={pop} className="s-pop on-light" role="dialog" aria-modal="true" aria-label={hint} onKeyDown={onKey}
            style={{ visibility: "hidden" }}
            onPointerLeave={() => setHover(null)}>
            <div className="s-pop__top">
              <button type="button" className="s-navb" aria-label={d.cal_prev} disabled={!canPrev}
                onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}><Arrow back /></button>
              <p aria-live="polite">{hint}</p>
              <button type="button" className="s-navb" aria-label={d.cal_next} onClick={() => setView(next)}><Arrow /></button>
            </div>
            <div className="s-cal">
              {[view, next].map((v) => (
                <Month key={`${v.y}-${v.m}`} y={v.y} m={v.m} lang={lang} today={today} start={start} end={end}
                  hover={hover} onPick={pick} onHover={setHover} />
              ))}
            </div>
            <div className="s-pop__foot">
              <button type="button" className="s-linkbtn" onClick={() => { setStart(null); setEnd(null); }}>{d.cal_clear}</button>
              <button type="button" className="s-btn s-btn--dark s-btn--sm" onClick={close} disabled={!start || !end}>{d.cal_done}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Month({ y, m, lang, today, start, end, hover, onPick, onHover }: {
  y: number; m: number; lang: Lang; today: string; start: string | null; end: string | null; hover: string | null;
  onPick: (d: string) => void; onHover: (d: string | null) => void;
}) {
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => iso(new Date(Date.UTC(y, m, i + 1))));
  const rangeEnd = end ?? (start && hover && hover > start && nights(start, hover) <= MAX_NIGHTS ? hover : null);
  return (
    <div className="s-month">
      <h3>{MONTHS[lang][m][0].toUpperCase() + MONTHS[lang][m].slice(1)} {y}</h3>
      <div className="s-wd" aria-hidden="true">{WEEK[lang].map((w) => <span key={w}>{w}</span>)}</div>
      <div className="s-days" role="group" aria-label={`${MONTHS[lang][m]} ${y}`}>
        {Array.from({ length: offset }, (_, i) => <span key={"p" + i} />)}
        {days.map((day) => {
          const past = day < today;
          const isStart = day === start, isEnd = day === rangeEnd;
          const inRange = Boolean(start && rangeEnd && day > start && day < rangeEnd);
          const cls = ["s-day", isStart && "is-start", isStart && !rangeEnd && "solo", isEnd && "is-end", inRange && "in-range", inRange && !end && "preview", day === today && "is-today"].filter(Boolean).join(" ");
          return (
            <button key={day} type="button" className={cls} data-day={day} disabled={past} aria-pressed={isStart || day === end}
              onClick={() => onPick(day)} onPointerEnter={() => !end && onHover(day)}>
              <span>{Number(day.slice(8))}</span>
              <span className="sr-only"> {MONTHS[lang][m]}, {WEEK_LONG[lang][dow(day)]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
