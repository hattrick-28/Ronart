import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eur, todayISO, shortDate } from "@/lib/format";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE, Pill } from "@/lib/labels";
import { Flash } from "@/components/admin/flash";

type Row = {
  id: string; ref: string; status: string; channel: string; check_in: string; check_out: string;
  total_amount: number; paid_amount: number; confirm_deadline: string | null; hold_expires_at: string | null;
  needs_refund: boolean; allow_overlap: boolean; payment_option: string;
  units: { name: string } | null; guests: { full_name: string; phone: string | null } | null;
};

const SELECT = "id, ref, status, channel, check_in, check_out, total_amount, paid_amount, confirm_deadline, hold_expires_at, needs_refund, allow_overlap, payment_option, units(name), guests(full_name, phone)";

function Balance({ b }: { b: Row }) {
  const due = Number(b.total_amount) - Number(b.paid_amount);
  if (b.channel === "airbnb") return <Pill tone="bg-ok-soft text-ok">Paguar · Airbnb</Pill>;
  if (due <= 0.009) return <Pill tone="bg-ok-soft text-ok">Paguar</Pill>;
  return <Pill tone="bg-warn-soft text-warn">Për t&apos;u paguar {eur(due)}</Pill>;
}

function List({ title, rows, empty, show = "balance" }: { title: string; rows: Row[]; empty: string; show?: "balance" | "deadline" }) {
  return (
    <section className="rounded-[var(--radius-panel)] bg-white border border-line">
      <h2 className="px-5 pt-4 pb-3 font-display text-lg font-semibold flex items-baseline justify-between">
        {title} <span className="text-sm font-sans font-medium text-ink-3">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="px-5 py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[8.5rem_1fr_auto] items-center gap-x-4 gap-y-1 hover:bg-milk">
                <span className="font-semibold whitespace-nowrap">{b.units?.name}</span>
                <span className="min-w-0 row-start-2 sm:row-start-auto col-span-2 sm:col-span-1">
                  <span className="block truncate">{b.guests?.full_name ?? "—"}</span>
                  <span className="block text-xs text-ink-3">{CHANNEL_LABEL[b.channel]}</span>
                </span>
                {show === "deadline" && b.confirm_deadline ? (
                  <Pill tone="bg-warn-soft text-warn">Anulohet {new Date(b.confirm_deadline).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Pill>
                ) : (
                  <Balance b={b} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Today({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaff();
  const supabase = await createClient();
  const today = todayISO();
  const startOfDay = new Date(`${today}T00:00:00+02:00`).toISOString();

  const [arrivals, departures, inHouse, pending, alerts, units, cashToday] = await Promise.all([
    supabase.from("bookings").select(SELECT).eq("check_in", today).in("status", ["confirmed", "checked_in", "pending"]).order("check_in"),
    supabase.from("bookings").select(SELECT).eq("check_out", today).in("status", ["checked_in", "confirmed", "checked_out"]),
    supabase.from("bookings").select("unit_id").lte("check_in", today).gt("check_out", today).in("status", ["confirmed", "checked_in"]),
    supabase.from("bookings").select(SELECT).eq("status", "pending").order("confirm_deadline"),
    supabase.from("bookings").select(SELECT).or("needs_refund.eq.true,allow_overlap.eq.true").not("status", "in", "(cancelled,checked_out)"),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("payments").select("amount").eq("method", "cash").eq("status", "succeeded").gte("created_at", startOfDay),
  ]);

  const total = units.count ?? 18;
  const occupied = new Set((inHouse.data ?? []).map((r) => r.unit_id)).size;
  const cash = (cashToday.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const alertRows = (alerts.data ?? []) as unknown as Row[];

  return (
    <div className="max-w-6xl">
      <Flash ok={sp.ok} err={sp.err} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{shortDate(today)} {today.slice(0, 4)}</p>
          <h1 className="font-display text-3xl font-semibold text-wall-deep">Sot</h1>
        </div>
        <Link href="/admin/bookings/new" className="btn btn-primary">Rezervim i ri</Link>
      </div>

      <dl className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Zënia sonte", `${Math.round((occupied / total) * 100)}%`, `${occupied} nga ${total} njësi`],
          ["Ardhje sot", String(arrivals.data?.length ?? 0), "check-in nga ora 16:00"],
          ["Të lira sonte", String(total - occupied), "njësi"],
          ["Para në dorë sot", eur(cash), "e regjistruar në panel"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-[var(--radius-panel)] bg-white border border-line px-5 py-4">
            <dt className="text-sm text-ink-2">{k}</dt>
            <dd className="font-display text-3xl font-semibold mt-1">{v}</dd>
            <dd className="text-xs text-ink-3 mt-0.5">{sub}</dd>
          </div>
        ))}
      </dl>

      {alertRows.length > 0 && (
        <section className="mt-6 rounded-[var(--radius-panel)] border border-bad/30 bg-bad-soft p-5">
          <h2 className="font-display text-lg font-semibold text-bad">Kërkojnë vëmendje tani</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {alertRows.map((b) => (
              <li key={b.id}>
                <Link className="underline font-medium" href={`/admin/bookings/${b.id}`}>{b.ref} · {b.units?.name}</Link>{" "}
                {b.allow_overlap ? "Mbirezervim: rezervim nga platforma mbi një rezervim tjetër." : "Pagesë pas skadimit: duhet rimbursim."}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        <List title="Ardhjet sot" rows={(arrivals.data ?? []) as unknown as Row[]} empty="Asnjë ardhje sot." />
        <List title="Largimet sot" rows={(departures.data ?? []) as unknown as Row[]} empty="Asnjë largim sot." />
        <List title="Pa konfirmuar (telefon)" rows={(pending.data ?? []) as unknown as Row[]} empty="Asnjë rezervim në pritje." show="deadline" />
        <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5 text-sm text-ink-2">
          <h2 className="font-display text-lg font-semibold text-ink">Si funksionon</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <Pill key={k} tone={STATUS_TONE[k]}>{v}</Pill>)}
          </div>
          <p className="mt-3">Rezervimet e paguara online konfirmohen vetë. Rezervimet me telefon anulohen vetë nëse nuk konfirmohen në kohë.</p>
        </section>
      </div>
    </div>
  );
}
