"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

/**
 * One motion system for the public site, on one clock (GSAP's ticker).
 * Concept: the warm light line between the green wall and the walnut switches on,
 * the wall warms up, the room brightens. Under reduced motion everything is static and visible.
 */
export function SiteMotion() {
  const path = usePathname();
  const lenis = useRef<Lenis | null>(null);
  const first = useRef(true);

  // global: smooth scroll, header that steps aside, scroll lock for dialogs
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf: ((t: number) => void) | null = null;
    if (!rm) {
      const l = new Lenis({ autoRaf: false, lerp: 0.1 });
      lenis.current = l;
      raf = (t: number) => l.raf(t * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      l.on("scroll", ScrollTrigger.update);
    }
    const hdr = document.getElementById("s-hdr");
    let lastY = 0;
    const st = ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (s) => {
        const y = s.scroll();
        hdr?.classList.toggle("is-hidden", y > 300 && y > lastY && !document.querySelector(".s-sheet.is-open, .s-pop"));
        lastY = y;
      },
    });
    const lock = (e: Event) => { const on = (e as CustomEvent<boolean>).detail; if (on) lenis.current?.stop(); else lenis.current?.start(); };
    window.addEventListener("rn:lock", lock);
    // same-page anchors (/#how) scroll smoothly
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href*='#']");
      if (!a) return;
      const url = new URL(a.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const el = document.getElementById(url.hash.slice(1));
      if (!el) return;
      e.preventDefault();
      history.replaceState(null, "", url.hash);
      if (lenis.current) lenis.current.scrollTo(el, { offset: url.hash === "#main" ? 0 : -84, duration: 1.2 });
      else el.scrollIntoView({ behavior: rm ? "auto" : "smooth" });
      if (url.hash === "#main") (el as HTMLElement).focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);
    return () => {
      st.kill(); window.removeEventListener("rn:lock", lock); document.removeEventListener("click", onClick);
      if (raf) gsap.ticker.remove(raf);
      lenis.current?.destroy(); lenis.current = null;
    };
  }, []);

  // per page: everything that belongs to the page is reverted on navigation
  useEffect(() => {
    const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = matchMedia("(hover: none)").matches;
    const root = document.documentElement;
    const offs: (() => void)[] = [];
    const wasFirst = first.current;
    first.current = false;

    // arrive at the top (or at the hash) on navigation
    if (!wasFirst) {
      const h = location.hash && document.getElementById(location.hash.slice(1));
      if (h) setTimeout(() => lenis.current ? lenis.current.scrollTo(h, { offset: -84, immediate: true }) : h.scrollIntoView(), 30);
      else if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
    }

    const ctx = gsap.context(() => {
      drawFan();
      if (rm) { root.classList.remove("pre"); return; }
      root.classList.add("js-motion");

      // page change: the walnut panel lifts off with its light edge
      if (!wasFirst) {
        const c = document.getElementById("s-curtain");
        if (c) gsap.fromTo(c, { clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut", delay: 0.05 });
      }

      // buttons: light floods in from the pointer's side
      if (!touch) document.querySelectorAll<HTMLElement>("[data-fill]").forEach((btn) => {
        const fill = btn.querySelector<HTMLElement>(".s-btn__fill");
        if (!fill) return;
        let closed = true;
        const at = (e: PointerEvent) => { const r = btn.getBoundingClientRect(); return `${e.clientX - r.left}px ${e.clientY - r.top}px`; };
        const open = (p: string) => {
          if ((btn as HTMLButtonElement).disabled) return;
          if (closed) gsap.set(fill, { clipPath: `circle(0% at ${p})` });
          closed = false; btn.classList.add("is-filled");
          gsap.to(fill, { clipPath: `circle(150% at ${p})`, duration: 0.6, ease: "power3.out", overwrite: true });
        };
        const close = (p: string) => {
          btn.classList.remove("is-filled");
          gsap.to(fill, { clipPath: `circle(0% at ${p})`, duration: 0.5, ease: "power3.out", overwrite: true, onComplete: () => { closed = true; } });
        };
        const enter = (e: PointerEvent) => open(at(e));
        const leave = (e: PointerEvent) => close(at(e));
        const focus = () => btn.matches(":focus-visible") && open("50% 50%");
        const blur = () => close("50% 50%");
        btn.addEventListener("pointerenter", enter); btn.addEventListener("pointerleave", leave);
        btn.addEventListener("focus", focus); btn.addEventListener("blur", blur);
        offs.push(() => {
          btn.removeEventListener("pointerenter", enter); btn.removeEventListener("pointerleave", leave);
          btn.removeEventListener("focus", focus); btn.removeEventListener("blur", blur);
        });
      });

      // hero: the cove light switches on, the wall warms, the room brightens
      const hero = document.querySelector<HTMLElement>(".s-hero");
      const fan = document.getElementById("s-fan");
      if (hero && fan) {
        const seam = hero.querySelector<HTMLElement>("[data-seam='hero']");
        const lamp = hero.querySelector<HTMLElement>("[data-lamp] img");
        const bloom = hero.querySelector<HTMLElement>("[data-bloom]");
        const lines = [...hero.querySelectorAll<HTMLElement>("h1 .ln")].flatMap((l) => new SplitText(l, { type: "lines", mask: "lines" }).lines);
        const lit = { v: 0 };
        gsap.set(seam, { scaleX: 0 });
        gsap.set(lamp, { filter: "brightness(.32) saturate(.7)", scale: 1.08 });
        gsap.set(lines, { yPercent: 110 });
        gsap.set(hero.querySelectorAll("[data-intro]"), { opacity: 0, y: 18 });
        gsap.set(fan, { opacity: 0 });
        root.classList.remove("pre");
        gsap.timeline({ delay: 0.15, defaults: { ease: "expo.out" } })
          .to(seam, { scaleX: 1, duration: 1.0, ease: "expo.inOut" }, 0)
          .to(seam, { keyframes: { opacity: [1, 0.25, 1, 0.55, 1] }, duration: 0.35, ease: "none" }, 0.95)
          .to(lit, { v: 1, duration: 1.4, ease: "power2.out" }, 1.05)
          .to(fan, { opacity: 0.9, duration: 1.6, ease: "power2.out" }, 1.1)
          .to(lamp, { scale: 1, duration: 1.8 }, 0.3)
          .to(lamp, { filter: "brightness(1) saturate(1)", duration: 1.2, ease: "power2.out", clearProps: "filter" }, 1.05)
          .to(lines, { yPercent: 0, duration: 1.15, stagger: 0.09 }, 0.4)
          .to(hero.querySelectorAll("[data-intro]"), { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 1.0);

        // idle: the fan lines drift with time and a lagged pointer while the hero is on screen
        const groups = fan.querySelectorAll("g");
        const idle = { x: 0, ax: 0 };
        const move = (e: PointerEvent) => { idle.ax = e.clientX / innerWidth - 0.5; };
        if (!touch) addEventListener("pointermove", move, { passive: true });
        const wall = ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top" });
        const tick = (t: number) => {
          if (!wall.isActive) return;
          const k = 1 - Math.pow(0.94, gsap.ticker.deltaRatio());
          idle.x += (idle.ax - idle.x) * k;
          gsap.set(groups[0], { rotation: Math.sin(t * 0.35) * 1.6 + idle.x * 3 });
          gsap.set(groups[1], { rotation: Math.cos(t * 0.3) * 1.3 - idle.x * 2.4 });
          gsap.set(bloom, { opacity: lit.v * (0.9 + Math.sin(t * 0.9) * 0.07 + Math.sin(t * 2.3) * 0.03) });
        };
        gsap.ticker.add(tick);
        offs.push(() => { gsap.ticker.remove(tick); removeEventListener("pointermove", move); });
      } else {
        root.classList.remove("pre");
      }

      document.querySelectorAll<HTMLElement>("[data-seam]:not([data-seam='hero'])").forEach((s) =>
        gsap.fromTo(s, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "expo.inOut", scrollTrigger: { trigger: s.parentElement, start: "top 92%", once: true } }));
      document.querySelectorAll<HTMLElement>("[data-split]").forEach((h) => {
        const sp = new SplitText(h, { type: "lines", mask: "lines" });
        gsap.from(sp.lines, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: h, start: "top 88%", once: true } });
      });
      document.querySelectorAll<HTMLElement>("[data-warm]").forEach((el) =>
        gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((fr) => {
        const img = fr.querySelector("img");
        gsap.timeline({ scrollTrigger: { trigger: fr, start: "top 88%", once: true } })
          .fromTo(fr, { clipPath: "inset(16% 0 0 0 round 18px)" }, { clipPath: "inset(0% 0 0 0 round 18px)", duration: 1.3, ease: "expo.out" }, 0)
          .fromTo(img, { filter: "brightness(.45)", scale: 1.1 }, { filter: "brightness(1)", scale: 1, duration: 1.5, ease: "power3.out", clearProps: "filter,scale" }, 0);
      });
      if (document.querySelector(".s-annot"))
        gsap.from(".s-pin", { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(2)", stagger: 0.12, scrollTrigger: { trigger: ".s-annot", start: "top 70%", once: true } });
      const tl = document.getElementById("s-tl");
      if (tl) {
        const mob = matchMedia("(max-width:960px)").matches;
        const steps = tl.querySelectorAll<HTMLElement>("li.st");
        gsap.fromTo("#s-tl-lit", mob ? { scaleY: 0, scaleX: 1 } : { scaleX: 0 }, {
          scaleX: 1, scaleY: 1, ease: "none",
          scrollTrigger: { trigger: tl, start: "top 75%", end: "bottom 55%", scrub: 0.6,
            onUpdate: (s) => steps.forEach((el, i) => el.classList.toggle("is-lit", s.progress >= i / steps.length + 0.02)) },
        });
      }
      const keys = document.querySelectorAll(".s-key");
      if (keys.length) gsap.from(keys, { y: 18, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.02, delay: wasFirst ? 0.1 : 0.45, clearProps: "all" });
      gsap.from(".s-foot__word", { yPercent: 40, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".s-foot", start: "top 94%", once: true } });
    });

    const refresh = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => { clearTimeout(refresh); offs.forEach((f) => f()); ctx.revert(); };
  }, [path]);

  return <div className="s-curtain" id="s-curtain" aria-hidden="true" />;
}

/** The leaf-fan relief of the green wall, drawn once per hero. */
function drawFan() {
  const svg = document.getElementById("s-fan");
  if (!svg || svg.childElementCount) return;
  const NS = "http://www.w3.org/2000/svg";
  [{ x: 180, y: 980, r: 1100, a0: -88, a1: -8, n: 46 }, { x: 1500, y: -80, r: 900, a0: 95, a1: 175, n: 38 }].forEach((f, fi) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("stroke", "#faf9f6"); g.setAttribute("stroke-opacity", fi ? ".07" : ".1");
    g.setAttribute("fill", "none"); g.setAttribute("stroke-width", "1.2");
    g.style.transformOrigin = `${f.x}px ${f.y}px`; g.style.transformBox = "view-box";
    for (let i = 0; i < f.n; i++) {
      const a = ((f.a0 + ((f.a1 - f.a0) * i) / (f.n - 1)) * Math.PI) / 180;
      const ex = f.x + Math.cos(a) * f.r, ey = f.y + Math.sin(a) * f.r, bend = (fi ? -1 : 1) * 0.18 * f.r;
      const cx = f.x + Math.cos(a) * f.r * 0.5 - Math.sin(a) * bend, cy = f.y + Math.sin(a) * f.r * 0.5 + Math.cos(a) * bend;
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", `M${f.x} ${f.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      g.append(p);
    }
    svg.append(g);
  });
}
