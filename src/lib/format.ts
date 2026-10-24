export const eur = (n: number | string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n));

const MONTHS_SQ = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Korr", "Gush", "Sht", "Tet", "Nën", "Dhj"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string, lang: "sq" | "en" = "sq") {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  void y;
  return `${d} ${(lang === "sq" ? MONTHS_SQ : MONTHS_EN)[m - 1]}`;
}

export function todayISO(tz = "Europe/Belgrade") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
