import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/lib/labels";
import { Flash } from "@/components/admin/flash";
import { setBlacklist } from "../../actions";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("guests").select("id, full_name, email, phone, country, is_blacklisted, blacklist_reason, no_show_count, bookings(count)").order("created_at", { ascending: false }).limit(200);
  const term = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  if (sp.blocked === "1") q = q.eq("is_blacklisted", true);
  const { data } = await q;

  return (
    <div className="max-w-5xl">
      <Flash ok={sp.ok} err={sp.err} />
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Mysafirët</h1>
      <form className="mt-5 flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-56"><span className="label">Kërko</span><input className="field" name="q" defaultValue={sp.q} placeholder="Emri, telefoni ose emaili" /></label>
        <label className="flex items-center gap-2 text-sm h-[46px]"><input type="checkbox" name="blocked" value="1" defaultChecked={sp.blocked === "1"} /> Vetëm të bllokuarit</label>
        <button className="btn btn-primary h-[46px]">Kërko</button>
      </form>
      <ul className="mt-5 rounded-[var(--radius-panel)] border border-line bg-white divide-y divide-line">
        {(data ?? []).map((g) => {
          const count = (g.bookings as unknown as { count: number }[])?.[0]?.count ?? 0;
          return (
            <li key={g.id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex-1 min-w-48">
                <p className="font-semibold">{g.full_name} {g.is_blacklisted && <Pill tone="bg-bad-soft text-bad">I bllokuar</Pill>}</p>
                <p className="text-sm text-ink-3">{[g.phone, g.email, g.country].filter(Boolean).join(" · ")}</p>
                {g.is_blacklisted && g.blacklist_reason && <p className="text-sm text-bad">{g.blacklist_reason}</p>}
              </div>
              <p className="text-sm text-ink-2">{count} rezervime{g.no_show_count ? ` · ${g.no_show_count} mosparaqitje` : ""}</p>
              <form action={setBlacklist} className="flex gap-2">
                <input type="hidden" name="guestId" value={g.id} />
                <input type="hidden" name="back" value="/admin/guests" />
                <input type="hidden" name="on" value={g.is_blacklisted ? "0" : "1"} />
                {!g.is_blacklisted && <input className="field !py-1.5 w-44" name="reason" placeholder="Arsyeja" maxLength={300} />}
                <button className={`btn !py-1.5 ${g.is_blacklisted ? "btn-ghost" : "btn-danger"}`}>{g.is_blacklisted ? "Hiq bllokimin" : "Blloko"}</button>
              </form>
            </li>
          );
        })}
        {(data ?? []).length === 0 && <li className="px-5 py-10 text-center text-ink-3">Asnjë mysafir nuk përputhet me kërkimin.</li>}
      </ul>
    </div>
  );
}
