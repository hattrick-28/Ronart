export const STATUS_LABEL: Record<string, string> = {
  hold: "Në pagesë",
  pending: "Pa konfirmuar",
  confirmed: "Konfirmuar",
  checked_in: "Brenda",
  checked_out: "Larguar",
  cancelled: "Anuluar",
  no_show: "Nuk erdhi",
};

export const STATUS_TONE: Record<string, string> = {
  hold: "bg-warn-soft text-warn",
  pending: "bg-warn-soft text-warn",
  confirmed: "bg-ok-soft text-ok",
  checked_in: "bg-wall text-milk",
  checked_out: "bg-milk-2 text-ink-3",
  cancelled: "bg-milk-2 text-ink-3 line-through",
  no_show: "bg-bad-soft text-bad",
};

export const CHANNEL_LABEL: Record<string, string> = {
  website: "Faqja",
  booking: "Booking.com",
  airbnb: "Airbnb",
  phone: "Telefon",
  walkin: "Në recepsion",
  other: "Tjetër",
};

/** Calendar bar colours by channel */
export const CHANNEL_BAR: Record<string, string> = {
  website: "bg-wall text-milk",
  booking: "bg-[#2b4a7a] text-white",
  airbnb: "bg-plum text-white",
  phone: "bg-walnut text-white",
  walkin: "bg-walnut-deep text-white",
  other: "bg-ink-3 text-white",
};

export const METHOD_LABEL: Record<string, string> = {
  card_online: "Kartelë online (NLB)",
  cash: "Para në dorë",
  card_pos: "Kartelë në POS",
  bank_transfer: "Transfertë bankare",
  channel: "Nga platforma",
};

export function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}>{children}</span>;
}
