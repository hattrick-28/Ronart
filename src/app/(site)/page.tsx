import Image from "next/image";
import Link from "next/link";
import { dict, getLang, t } from "@/lib/i18n";
import { SearchBar } from "@/components/search-bar";
import { listUnits } from "@/lib/availability";
import { eur, todayISO } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";
import { Arrow } from "@/components/site/arrow";
import { RoomPins } from "@/components/site/room-pins";

export default async function Home() {
  const lang = await getLang();
  const d = dict[lang];
  const [units, s] = await Promise.all([listUnits(), getSettings()]);
  const of = (type: "apartment" | "suite") => units.filter((u) => u.type === type);
  const minPrice = (type: "apartment" | "suite") => Math.min(...of(type).map((u) => u.base_price));
  const nApt = of("apartment").length, nSuite = of("suite").length;
  const aptBalconies = of("apartment").filter((u) => u.has_balcony).length;
  const size = (type: "apartment" | "suite") => of(type).find((u) => u.size_m2)?.size_m2;
  const maxG = (type: "apartment" | "suite") => Math.max(...of(type).map((u) => u.max_guests));
  const from = Math.min(minPrice("apartment"), minPrice("suite"));
  const v = { pct: s.full_payment_discount_pct, days: s.free_cancellation_days, min: s.hold_minutes, time: s.check_in_time };

  const types = [
    { type: "apartment" as const, cls: "", img: "/rooms/apartment.jpg", alt: d.apt_alt, h: t(d.apts_n, { n: nApt }), p: d.apt_p, cta: d.see_apts,
      spec: [[d.spec_size, size("apartment") ? `${size("apartment")} m²` : null], [d.spec_cap, `${maxG("apartment")} ${d.people}`], [d.spec_bed, d.spec_double], [d.spec_bal, t(d.spec_of, { a: aptBalconies, b: nApt })]] },
    { type: "suite" as const, cls: " s-type--suite", img: "/rooms/suite.jpg", alt: d.suite_alt, h: t(d.suites_n, { n: nSuite }), p: d.suite_p, cta: d.see_suites,
      spec: [[d.spec_size, size("suite") ? `${size("suite")} m²` : null], [d.spec_cap, `${d.up_to} ${maxG("suite")}`], [d.spec_bal, d.spec_yes]] },
  ];

  return (
    <>
      <section className="s-hero" aria-labelledby="h1">
        <div className="s-hero__wall">
          <div className="s-fanbox" aria-hidden="true">
            <svg className="s-fan" id="s-fan" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" />
            <div className="s-bloom" data-bloom />
          </div>
          <div className="s-wrap">
            <div className="s-grid s-hero__grid">
              <div className="s-hero__text">
                <h1 id="h1"><span className="ln">{d.hero_h1a}</span><span className="ln">{d.hero_h1b}</span></h1>
                <p className="s-hero__lede" data-intro>{t(d.hero_lede, { apts: nApt, suites: nSuite })}</p>
              </div>
              <div className="s-hero__photo">
                <div className="s-frame" data-lamp>
                  <Image src="/rooms/suite.jpg" alt={d.hero_alt} width={1536} height={1024} priority sizes="(min-width: 960px) 40vw, 90vw" style={{ objectPosition: "68% 50%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="s-seam" aria-hidden="true"><div className="s-seam__line" data-seam="hero" /></div>
        <div className="s-hero__floor">
          <div className="s-wrap">
            <SearchBar d={d} lang={lang} today={todayISO()} />
            <p className="s-hero__facts" data-intro>
              <span>{d.f_checkin} <strong>{s.check_in_time}</strong></span>
              <span>{d.f_cancel_a} <strong>{s.free_cancellation_days}</strong> {d.f_cancel_b}</span>
              {Number.isFinite(from) && <span>{d.f_from} <strong>{eur(from)}</strong> {d.f_night}</span>}
            </p>
          </div>
        </div>
      </section>

      <section className="s-sec on-light" aria-labelledby="h-types">
        <div className="s-wrap">
          <div className="s-grid s-compare__head">
            <h2 id="h-types" data-split>{d.types_h}</h2>
            <p className="muted" data-warm>{d.types_p}</p>
          </div>
          <div className="s-types">
            {types.map((x) => (
              <Link key={x.type} href={`/rooms#${x.type}`} className={`s-type${x.cls}`}>
                <div className="s-frame" data-reveal>
                  <Image src={x.img} alt={x.alt} width={1536} height={1024} sizes="(min-width: 960px) 55vw, 100vw" />
                </div>
                <div className="s-type__row">
                  <h3>{x.h}</h3>
                  {Number.isFinite(minPrice(x.type)) && <p className="s-type__price">{d.from} <b>{eur(minPrice(x.type))}</b> {d.per_night}</p>}
                </div>
                <p className="muted">{x.p}</p>
                <dl className="s-spec">
                  {x.spec.filter(([, val]) => val).map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                </dl>
                <span className="s-type__cta">{x.cta}<Arrow /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="s-sec s-detail" aria-labelledby="h-detail">
        <div className="s-wrap">
          <div className="s-grid s-detail__head">
            <h2 id="h-detail" data-split>{d.det_h}</h2>
            <p data-warm>{d.det_p}</p>
          </div>
          <div className="s-grid">
            <RoomPins alt={d.det_alt} items={[
              { h: d.d1h, p: d.d1p, x: 13, y: 22 },
              { h: d.d2h, p: d.d2p, x: 20, y: 40 },
              { h: d.d3h, p: d.d3p, x: 36, y: 60 },
              { h: d.d4h, p: d.d4p, x: 82, y: 66 },
            ]} />
          </div>
        </div>
      </section>

      <section className="s-sec s-how" id="how" aria-labelledby="h-how">
        <div className="s-seam s-seam--top" aria-hidden="true"><div className="s-seam__line" data-seam /></div>
        <div className="s-wrap">
          <h2 id="h-how" data-split>{d.how_title}</h2>
          <div className="s-pays" data-warm>
            <div className="s-payc s-payc--hi">
              <span className="s-payc__k">{t(d.save_pct, v)}</span>
              <h3>{d.how_full_t}</h3>
              <p>{t(d.how_full_d, v)}</p>
            </div>
            <div className="s-payc">
              <h3>{d.how_dep_t}</h3>
              <p>{d.how_dep_d}</p>
            </div>
          </div>
          <ol className="s-tl" id="s-tl">
            <li className="s-tl__rail" aria-hidden="true" role="presentation"><span className="s-tl__lit" id="s-tl-lit" /></li>
            {[[d.t1h, d.t1p], [d.t2h, d.t2p], [d.t3h, d.t3p], [d.t4h, d.t4p]].map(([h, p], i) => (
              <li key={i} className="st"><span className="dot" aria-hidden="true">{i + 1}</span><h3>{t(h, v)}</h3><p>{t(p, v)}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="s-sec s-faqs" id="faq" aria-labelledby="h-faq">
        <div className="s-seam s-seam--top" aria-hidden="true"><div className="s-seam__line" data-seam /></div>
        <div className="s-wrap s-faq">
          <h2 id="h-faq" data-split>{d.faq_h}</h2>
          {[[d.q1, d.a1], [d.q2, d.a2], [d.q3, d.a3], [d.q4, d.a4]].map(([q, a]) => (
            <details key={q}>
              <summary><span>{t(q, v)}</span><span className="s-pm" aria-hidden="true" /></summary>
              <p>{t(a, v)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="s-sec s-contact" id="contact" aria-labelledby="h-contact">
        <div className="s-seam s-seam--top" aria-hidden="true"><div className="s-seam__line" data-seam /></div>
        <div className="s-wrap">
          <div className="s-grid">
            <h2 id="h-contact" data-split>{d.contact_h}</h2>
            <dl className="s-clist" data-warm>
              <div><dt>{d.address}</dt><dd>{SITE.address}</dd></div>
              <div><dt>{d.phone}</dt><dd><a className="s-ilink" href={SITE.phoneHref}>{SITE.phone}</a></dd></div>
              <div><dt>{d.email}</dt><dd><a className="s-ilink" href={`mailto:${SITE.email}`}>{SITE.email}</a></dd></div>
              <div><dt>Instagram</dt><dd><a className="s-ilink" href="https://www.instagram.com/ronart.apartments/" rel="noopener">@ronart.apartments</a></dd></div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
