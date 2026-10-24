import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict, getLang } from "@/lib/i18n";
import { verify } from "@/lib/sign";
import { createAdminClient } from "@/lib/supabase/admin";
import { eur, shortDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Rezervimi", robots: { index: false } };

export default async function DonePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ref, t } = await searchParams;
  if (!ref || !verify("done:" + ref, t)) notFound();
  const lang = await getLang();
  const d = dict[lang];
  const s = await getSettings();
  const { data: b } = await createAdminClient()
    .from("bookings")
    .select("ref, status, check_in, check_out, total_amount, paid_amount, units(name)")
    .eq("ref", ref)
    .single();
  if (!b) notFound();
  const ok = ["confirmed", "checked_in", "checked_out"].includes(b.status);
  const waiting = b.status === "hold";
  const rest = Number(b.total_amount) - Number(b.paid_amount);
  const unit = b.units as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <div className={`h-1.5 w-16 rounded-full ${ok ? "bg-ok" : waiting ? "bg-glow" : "bg-bad"}`} />
      <h1 className="mt-5 font-display text-4xl font-semibold text-wall-deep">
        {ok ? d.done_ok_t : waiting ? d.done_wait_t : d.done_fail_t}
      </h1>
      <p className="mt-3 text-ink-2 text-lg">{ok ? d.done_ok_d : waiting ? d.done_wait_d : d.done_fail_d}</p>
      {ok && (
        <dl className="mt-8 rounded-[var(--radius-panel)] border border-line bg-white p-6 text-sm space-y-2.5">
          <div className="flex justify-between"><dt className="text-ink-2">{d.booking_ref}</dt><dd className="font-semibold tracking-wide">{b.ref}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">{unit?.name}</dt><dd>{shortDate(b.check_in, lang)} – {shortDate(b.check_out, lang)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">{d.check_in_at}</dt><dd>{s.check_in_time}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">{d.check_out_at}</dt><dd>{s.check_out_time}</dd></div>
          <div className="flex justify-between border-t border-line pt-2.5"><dt className="text-ink-2">{d.paid}</dt><dd className="font-semibold">{eur(b.paid_amount)}</dd></div>
          {rest > 0.009 && <div className="flex justify-between"><dt className="text-ink-2">{d.to_pay_arrival}</dt><dd className="font-semibold">{eur(rest)}</dd></div>}
        </dl>
      )}
      <Link href={ok ? "/" : "/rooms"} className="btn btn-ghost mt-8">{ok ? d.back_home : d.search}</Link>
    </div>
  );
}
