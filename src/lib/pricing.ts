export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Quote = {
  nights: number;
  nightly: number;
  total: number;
  /** amount charged now if paying in full (with discount) */
  fullNow: number;
  /** deposit (first night) if paying a deposit */
  depositNow: number;
  /** rest paid on arrival in the deposit option */
  depositRest: number;
  discountPct: number;
};

/**
 * total: price for the stay (from Beds24 when connected, otherwise base price × nights).
 * The discounted full amount becomes the booking total for the "full" option.
 */
export function quote(nightly: number, nights: number, discountPct: number, total?: number): Quote {
  const t = round2(total ?? nightly * nights);
  const firstNight = round2(t / nights);
  const fullNow = round2(t * (1 - discountPct / 100));
  return {
    nights,
    nightly: firstNight,
    total: t,
    fullNow,
    depositNow: firstNight,
    depositRest: round2(t - firstNight),
    discountPct,
  };
}
