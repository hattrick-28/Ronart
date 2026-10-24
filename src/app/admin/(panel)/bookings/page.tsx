import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eur, shortDate } from "@/lib/format";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE, Pill } from "@/lib/labels";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("bookings")
    .select("id, ref, status, channel, check_in, check_out, total_amount, paid_amount, units(name), guests!inner(full_name, phone, email)")
    .order("check_in", { ascending: sp.order !== "desc" })
    .limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  else q = q.not("status", "in", "(cancelled)");
  if (sp.channel) q = q.eq("channel", sp.channel);
  if (sp.from) q = q.gte("check_in", sp.from);
  if (sp.to) q = q.lte("check_in", sp.to);
  const term = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  if (term) {
    q = term.toUpperCase().startsWith("RON-")
      ? q.eq("ref", term.toUpperCase())
      : q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`, { referencedTable: "guests" });
  }
  const { data, error } = await q;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Rezervimet</h1>
      <form className="mt-5 grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 items-end">
        <label className="col-span-2 md:col-span-1"><span className="label">Kërko</span><input className="field" name="q" defaultValue={sp.q} placeholder="Emri, telefoni, RON-…" /></label>
        <label><span className="label">Statusi</span>
          <select className="field" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Aktive</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label><span className="label">Kanali</span>
          <select className="field" name="channel" defaultValue={sp.channel ?? ""}>
            <option value="">Të gjitha</option>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label><span className="label">Ardhja nga</span><input className="field" type="date" name="from" defaultValue={sp.from} /></label>
        <label><span className="label">deri</span><input className="field" type="date" name="to" defaultValue={sp.to} /></label>
        <button className="btn btn-primary h-[46px] col-span-2 md:col-span-1">Filtro</button>
      </form>

      {error && <p className="mt-4 text-bad text-sm">{error.message}</p>}
      <div className="mt-5 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-white">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="text-left text-ink-3 border-b border-line">
            <tr>
              {["Nr.", "Mysafiri", "Njësia", "Datat", "Kanali", "Statusi", "Paguar / Gjithsej"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data ?? []).map((b) => {
              const g = b.guests as unknown as { full_name: string; phone: string | null };
              const u = b.units as unknown as { name: string };
              return (
                <tr key={b.id} className="hover:bg-milk">
                  <td className="px-4 py-3"><Link href={`/admin/bookings/${b.id}`} className="font-semibold underline-offset-2 hover:underline">{b.ref}</Link></td>
                  <td className="px-4 py-3">{g?.full_name}<div className="text-xs text-ink-3">{g?.phone}</div></td>
                  <td className="px-4 py-3">{u?.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{shortDate(b.check_in)} – {shortDate(b.check_out)}</td>
                  <td className="px-4 py-3">{CHANNEL_LABEL[b.channel]}</td>
                  <td className="px-4 py-3"><Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill></td>
                  <td className="px-4 py-3 whitespace-nowrap">{eur(b.paid_amount)} / {eur(b.total_amount)}</td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-3">Asnjë rezervim me këto filtra. <Link href="/admin/bookings/new" className="underline">Krijo një rezervim</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
