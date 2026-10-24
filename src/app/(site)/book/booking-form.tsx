"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Dict, Lang } from "@/lib/i18n";
import type { Quote } from "@/lib/pricing";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export function BookingForm(props: {
  lang: Lang; d: Dict; unitId: string; checkIn: string; checkOut: string; guests: number; quote: Quote; turnstileSiteKey: string;
}) {
  const { d, quote: q, lang } = props;
  const [option, setOption] = useState<"full" | "deposit">("deposit");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  function renderWidget() {
    if (!props.turnstileSiteKey || !widget.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: props.turnstileSiteKey,
      language: lang === "sq" ? "sq" : "en",
      callback: (tk: string) => setToken(tk),
      "expired-callback": () => setToken(null),
    });
  }
  useEffect(renderWidget);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (props.turnstileSiteKey && !token) {
      setError(d.err_captcha);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId: props.unitId,
          checkIn: props.checkIn,
          checkOut: props.checkOut,
          adults: props.guests,
          children: 0,
          fullName: f.get("fullName"),
          email: f.get("email"),
          phone: f.get("phone"),
          country: f.get("country") || undefined,
          note: f.get("note") || undefined,
          option,
          acceptTerms: f.get("terms") === "on",
          turnstileToken: token,
          lang,
        }),
      });
      const json = (await res.json()) as { redirectUrl?: string; error?: string };
      if (res.ok && json.redirectUrl) {
        window.location.assign(json.redirectUrl);
        return;
      }
      const map: Record<string, string> = {
        unavailable: d.err_unavailable, blocked: d.err_blocked, limit: d.err_limit, rate: d.err_rate, captcha: d.err_captcha,
      };
      setError(map[json.error ?? ""] ?? d.err_generic);
      window.turnstile?.reset(widgetId.current);
      setToken(null);
    } catch {
      setError(d.err_generic);
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { id: "deposit" as const, title: d.pay_deposit, now: q.depositNow, sub: `${eur(q.depositRest)} ${d.rest_on_arrival}` },
    { id: "full" as const, title: d.pay_full, now: q.fullNow, sub: `−${q.discountPct}%` },
  ];
  const payToday = option === "full" ? q.fullNow : q.depositNow;

  return (
    <form onSubmit={submit} className="space-y-9">
      {props.turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderWidget} />
      )}
      <fieldset>
        <legend className="font-display text-xl font-semibold mb-4">{d.your_details}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2"><span className="label">{d.full_name}</span>
            <input className="field" name="fullName" required minLength={3} maxLength={100} autoComplete="name" />
          </label>
          <label><span className="label">{d.email}</span>
            <input className="field" name="email" type="email" required maxLength={200} autoComplete="email" />
          </label>
          <label><span className="label">{d.phone}</span>
            <input className="field" name="phone" type="tel" required pattern="\+?[0-9 ()\-]{6,20}" autoComplete="tel" placeholder="+383 44 000 000" />
          </label>
          <label><span className="label">{d.country}</span>
            <input className="field" name="country" maxLength={60} autoComplete="country-name" />
          </label>
          <label className="sm:col-span-2"><span className="label">{d.note}</span>
            <textarea className="field min-h-24" name="note" maxLength={500} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-xl font-semibold mb-4">{d.payment}</legend>
        <div className="grid sm:grid-cols-2 gap-3" role="radiogroup">
          {options.map((o) => {
            const on = option === o.id;
            return (
              <label key={o.id} className={`cursor-pointer rounded-[var(--radius-panel)] border p-5 transition-colors ${on ? "border-wall bg-wall-soft/60 ring-1 ring-wall" : "border-line bg-white hover:border-ink-3"}`}>
                <input type="radio" name="option" value={o.id} checked={on} onChange={() => setOption(o.id)} className="sr-only" />
                <span className="block font-semibold">{o.title}</span>
                <span className="block font-display text-2xl font-semibold mt-1">{eur(o.now)}</span>
                <span className="block text-sm text-ink-3 mt-0.5">{o.sub}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-4">
        <label className="flex gap-3 items-start text-sm">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--color-wall)]" />
          <span>
            {d.accept_terms}{" "}
            <a href="/cancellation" target="_blank" className="underline">{d.footer_cancel}</a>
          </span>
        </label>
        <div ref={widget} />
        {error && <p role="alert" className="rounded-[var(--radius-field)] bg-bad-soft text-bad px-4 py-3 text-sm">{error}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-primary text-base px-6" disabled={busy}>
            {busy ? "…" : `${d.pay_now} · ${eur(payToday)}`}
          </button>
          <p className="text-xs text-ink-3 max-w-[40ch]">{d.secure_note}</p>
        </div>
      </div>
    </form>
  );
}
