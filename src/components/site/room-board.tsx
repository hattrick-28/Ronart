"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { Arrow, Fill } from "./arrow";

export type BoardUnit = {
  id: string; code: string; name: string; type: "apartment" | "suite"; max_guests: number; size_m2: number | null;
  has_balcony: boolean; available: boolean; price: number;
};
export type BoardGroup = {
  type: "apartment" | "suite"; title: string; desc: string | null; img: string;
  spec: [string, string][]; units: BoardUnit[];
};

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/**
 * A key board: one tile per room. With dates chosen, a lit lamp means the room is free
 * (our database AND Beds24 agree); picking a tile opens the tray that leads to /book.
 */
export function RoomBoard({ d, groups, search, nightsLabel, guests }: {
  d: Dict; groups: BoardGroup[]; search: { in: string; out: string; guests: number } | null; nightsLabel: string; guests: number;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const all = groups.flatMap((g) => g.units);
  const u = all.find((x) => x.id === sel);
  const href = u && search ? `/book?unit=${u.id}&in=${search.in}&out=${search.out}&guests=${search.guests}` : "#";

  return (
    <>
      <div className="s-board">
        {groups.map((g) => (
          <section key={g.type} id={g.type} aria-labelledby={`g-${g.type}`}>
            <div className="s-group__head">
              <div className="s-frame" data-reveal><Image src={g.img} alt="" width={1536} height={1024} sizes="(min-width: 960px) 40vw, 100vw" /></div>
              <div className="s-group__txt">
                <h2 id={`g-${g.type}`}>{g.title}</h2>
                {g.desc && <p className="muted">{g.desc}</p>}
                <dl className="s-spec">{g.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              </div>
            </div>
            <ul className="s-keys">
              {g.units.map((x) => {
                const fits = x.max_guests >= guests;
                const free = Boolean(search) && x.available && fits;
                const pressed = sel === x.id;
                const status = !search ? "" : !fits ? d.too_many.replace("{n}", String(guests)) : free ? d.tile_free : d.unavailable;
                const priceTxt = search ? d.unit_for.replace("{price}", eur(x.price)).replace("{nights}", nightsLabel) : `${eur(x.price)} ${d.per_night}`;
                return (
                  <li key={x.id}>
                    <button type="button"
                      className={`s-key${search && !free ? " is-off" : ""}${!search ? " is-idle" : ""}`}
                      aria-pressed={pressed}
                      aria-disabled={!free || undefined}
                      onClick={() => { if (free) setSel(pressed ? null : x.id); }}>
                      {search && <span className="s-key__lamp" aria-hidden="true" />}
                      {x.has_balcony && <span className="s-key__bal">{d.balcony}</span>}
                      <span className="s-key__no">{x.code}</span>
                      <span className="s-key__meta">{x.size_m2 ? `${x.size_m2} m², ` : ""}{d.up_to} {x.max_guests}</span>
                      <span className="s-key__price">{search && !free ? status : priceTxt}</span>
                      <span className="sr-only">{x.name}{status ? `, ${status}` : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className={`s-tray${u ? " is-up" : ""}`} role="region" aria-label={d.selected} aria-hidden={!u} aria-live="polite">
        <div>
          <strong>{u ? `${u.name}, ${eur(u.price)}` : ""}</strong>
          <span>{u && search ? `${nightsLabel}, ${search.guests} ${d.people}` : ""}</span>
        </div>
        <Link className="s-btn" href={href} tabIndex={u ? 0 : -1} data-fill><Fill />{d.continue}<Arrow /></Link>
      </div>
    </>
  );
}
