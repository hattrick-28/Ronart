"use client";

import Image from "next/image";
import { useState } from "react";

type Item = { h: string; p: string; x: number; y: number };

/** The annotated room photo: numbers on the image and the legend light up together. */
export function RoomPins({ items, alt }: { items: Item[]; alt: string }) {
  const [on, setOn] = useState(1);
  const fine = () => typeof window !== "undefined" && matchMedia("(hover: hover)").matches;
  return (
    <>
      <div className="s-annot">
        <div className="s-frame" data-reveal>
          <Image src="/rooms/apartment.jpg" alt={alt} width={1536} height={1024} sizes="(min-width: 960px) 66vw, 100vw" />
        </div>
        {items.map((it, i) => (
          <button key={i} type="button" className={`s-pin${on === i ? " is-on" : ""}`} style={{ left: `${it.x}%`, top: `${it.y}%` }}
            aria-label={`${i + 1}, ${it.h}`} aria-pressed={on === i}
            onClick={() => setOn(i)} onFocus={() => setOn(i)} onPointerEnter={() => fine() && setOn(i)}>
            {i + 1}
          </button>
        ))}
      </div>
      <ol className="s-legend">
        {items.map((it, i) => (
          <li key={i} className={on === i ? "is-on" : undefined} onPointerEnter={() => fine() && setOn(i)}>
            <span className="n" aria-hidden="true">{i + 1}</span>
            <div><h3>{it.h}</h3><p>{it.p}</p></div>
          </li>
        ))}
      </ol>
    </>
  );
}
