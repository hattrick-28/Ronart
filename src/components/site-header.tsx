"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { Fill, Wordmark } from "./site/arrow";

export function SiteHeader({ d, lang }: { d: Dict; lang: Lang }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
      if (e.key === "Tab" && sheet.current && btn.current) {
        const f = [...sheet.current.querySelectorAll("a"), btn.current] as HTMLElement[];
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const links = [
    { href: "/rooms", label: d.nav_rooms, current: path.startsWith("/rooms") },
    { href: "/#how", label: d.nav_how },
    { href: "/#faq", label: d.nav_faq },
    { href: "/#contact", label: d.nav_contact },
  ];

  return (
    <>
      <a className="s-skip" href="#main">{d.skip}</a>
      <header className="s-hdr" id="s-hdr">
        <div className="s-hdr__in">
          <Link className="s-logo" href="/">
            <span className="s-logo__word"><Wordmark /></span>
            <span className="s-logo__sub"> Apartments</span>
          </Link>
          <nav aria-label={d.menu}>
            <ul className="s-nav">
              {links.map((l) => (
                <li key={l.href}>
                  <Link className="s-draw" href={l.href} aria-current={l.current ? "page" : undefined}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="s-hdr__end">
            <div className="s-lang" role="group" aria-label={d.lang_label}>
              {/* full page loads on purpose: the route sets the language cookie and redirects back */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/lang?to=sq" lang="sq" aria-current={lang === "sq" ? "true" : undefined}>SQ</a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/lang?to=en" lang="en" aria-current={lang === "en" ? "true" : undefined}>EN</a>
            </div>
            <Link className="s-btn s-btn--sm" href="/rooms" data-fill><Fill />{d.nav_book}</Link>
            <button
              ref={btn}
              type="button"
              className="s-menu-btn"
              aria-expanded={open}
              aria-controls="s-sheet"
              aria-label={open ? d.menu_close : d.menu_open}
              onClick={() => setOpen((o) => !o)}
            >
              <span /><span />
            </button>
          </div>
        </div>
      </header>
      <div ref={sheet} id="s-sheet" className={`s-sheet${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label={d.menu}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
        ))}
        <hr />
        <Link href="/rooms" onClick={() => setOpen(false)}>{d.nav_book}</Link>
      </div>
    </>
  );
}
