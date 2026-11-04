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
    <div className="s-wrap on-light">
      <div className="s-done">
        <div className={`s-done__bar${ok ? " ok" : waiting ? "" : " bad"}`} />
        <h1>{ok ? d.done_ok_t : waiting ? d.done_wait_t : d.done_fail_t}</h1>
        <p className="muted" style={{ fontSize: 18 }}>{ok ? d.done_ok_d : waiting ? d.done_wait_d : d.done_fail_d}</p>
        {ok && (
          <dl>
            <div><dt>{d.booking_ref}</dt><dd className="ref">{b.ref}</dd></div>
            <div><dt>{unit?.name}</dt><dd>{shortDate(b.check_in, lang)} – {shortDate(b.check_out, lang)}</dd></div>
            <div><dt>{d.check_in_at}</dt><dd>{s.check_in_time}</dd></div>
            <div><dt>{d.check_out_at}</dt><dd>{s.check_out_time}</dd></div>
            <div><dt>{d.paid}</dt><dd>{eur(b.paid_amount)}</dd></div>
            {rest > 0.009 && <div><dt>{d.to_pay_arrival}</dt><dd>{eur(rest)}</dd></div>}
          </dl>
        )}
        <Link href={ok ? "/" : "/rooms"} className="s-btn s-btn--ghost" style={{ marginTop: 28 }} data-fill>
          <span className="s-btn__fill" aria-hidden="true" />{ok ? d.back_home : d.search}
        </Link>
      </div>
    </div>
  );
}
