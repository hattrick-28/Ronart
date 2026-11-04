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

const t = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
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
    { id: "full" as const, title: d.pay_full, now: q.fullNow, sub: t(d.full_sub, { pct: q.discountPct }), tag: t(d.save_pct, { pct: q.discountPct }) },
    { id: "deposit" as const, title: d.pay_deposit, now: q.depositNow, sub: `${eur(q.depositRest)} ${d.rest_on_arrival}. ${d.rest_reception}`, tag: null },
  ];
  const payToday = option === "full" ? q.fullNow : q.depositNow;

  return (
    <form onSubmit={submit} className="s-panel">
      {props.turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderWidget} />
      )}
      <fieldset className="s-fs">
        <legend>{d.your_details}</legend>
        <div className="s-form">
          <label className="s-field full"><span>{d.full_name}</span>
            <input name="fullName" required minLength={3} maxLength={100} autoComplete="name" />
          </label>
          <label className="s-field"><span>{d.email}</span>
            <input name="email" type="email" required maxLength={200} autoComplete="email" />
          </label>
          <label className="s-field"><span>{d.phone}</span>
            <input name="phone" type="tel" required pattern="\+?[0-9 ()\-]{6,20}" autoComplete="tel" placeholder="+383 44 000 000" />
          </label>
          <label className="s-field"><span>{d.country}</span>
            <input name="country" maxLength={60} autoComplete="country-name" />
          </label>
          <label className="s-field full"><span>{d.note}</span>
            <textarea name="note" maxLength={500} />
          </label>
        </div>
      </fieldset>

      <fieldset className="s-fs">
        <legend>{d.payment}</legend>
        <div className="s-pay">
          {options.map((o) => (
            <label key={o.id} className="s-opt">
              <input type="radio" name="option" value={o.id} checked={option === o.id} onChange={() => setOption(o.id)} />
              <strong>{o.title}</strong>
              <span className="amt">{eur(o.now)}</span>
              <span className="small muted">{o.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="s-check">
        <input type="checkbox" name="terms" required />
        <span>
          {d.accept_terms}{" "}
          <a href="/cancellation" target="_blank">{d.footer_cancel}</a>
        </span>
      </label>
      <div ref={widget} style={{ marginTop: 16 }} />
      {error && <p role="alert" className="s-err">{error}</p>}
      <div className="s-submit">
        <button className="s-btn s-btn--dark" disabled={busy} data-fill>
          <span className="s-btn__fill" aria-hidden="true" />
          {busy ? "…" : `${d.pay_now} · ${eur(payToday)}`}
        </button>
        <p>{d.secure_note}</p>
      </div>
    </form>
  );
}
