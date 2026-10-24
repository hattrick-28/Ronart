import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { beds24Connected } from "@/lib/beds24";
import { isTestPayments } from "@/lib/payments";
import { Flash } from "@/components/admin/flash";
import { Pill } from "@/lib/labels";
import { connectBeds24, inviteStaff, setStaffActive, updateSettings, updateUnit } from "../../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff({ owner: true });
  const sp = await searchParams;
  const supabase = await createClient();
  const [s, connected, { data: units }, { data: staff }] = await Promise.all([
    getSettings(),
    beds24Connected().catch(() => false),
    supabase.from("units").select("id, code, name, base_price, max_guests, size_m2, has_balcony, active").order("sort"),
    supabase.from("staff").select("user_id, full_name, role, active").order("created_at"),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const field = (k: keyof typeof s, label: string, hint: string) => (
    <label key={k}><span className="label">{label}</span>
      <input className="field" name={k} defaultValue={String(s[k])} />
      <span className="text-xs text-ink-3">{hint}</span>
    </label>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <Flash ok={sp.ok} err={sp.err} />
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Cilësimet</h1>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Lidhjet</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="flex items-center gap-2">Beds24 {connected ? <Pill tone="bg-ok-soft text-ok">I lidhur</Pill> : <Pill tone="bg-bad-soft text-bad">Pa lidhje</Pill>}</p>
            <p className="text-ink-3 mt-1">Webhook URL (vendose te Beds24 → Properties → Access → Booking webhooks):</p>
            <code className="block mt-1 break-all bg-milk-2 rounded-lg px-2 py-1 text-xs">{site}/api/beds24/webhook?key=•••••• (BEDS24_WEBHOOK_SECRET)</code>
            <form action={connectBeds24} className="mt-3 flex gap-2">
              <input className="field" name="code" placeholder="Kodi i ri i ftesës nga Beds24" autoComplete="off" />
              <button className="btn btn-ghost whitespace-nowrap">{connected ? "Rilidh" : "Lidh"}</button>
            </form>
          </div>
          <div>
            <p className="flex items-center gap-2">Pagesat {isTestPayments() ? <Pill tone="bg-warn-soft text-warn">Modalitet testi</Pill> : <Pill tone="bg-ok-soft text-ok">NLB aktiv</Pill>}</p>
            <p className="text-ink-3 mt-1">{isTestPayments() ? "Pagesat janë simulim. Mos e hap faqen për publikun derisa të lidhet NLB." : "Pagesat shkojnë te NLB."}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Rregullat e rezervimit</h2>
        <form action={updateSettings} className="mt-4 grid sm:grid-cols-3 gap-4">
          {field("hold_minutes", "Mbajtja gjatë pagesës (min)", "5–60")}
          {field("full_payment_discount_pct", "Zbritja për pagesë të plotë (%)", "0–30")}
          {field("free_cancellation_days", "Anulim falas deri (ditë para)", "0–60")}
          {field("phone_confirm_hours", "Afati për konfirmim me telefon (orë)", "1–168")}
          {field("max_active_bookings_per_contact", "Maks. rezervime aktive për kontakt", "kundër bllokimit të dhomave")}
          {field("check_in_time", "Check-in nga", "p.sh. 16:00")}
          {field("check_out_time", "Check-out deri", "p.sh. 10:00")}
          <div className="sm:col-span-3"><button className="btn btn-primary">Ruaj rregullat</button></div>
        </form>
      </section>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Stafi</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {(staff ?? []).map((m) => (
            <li key={m.user_id} className="py-2.5 flex items-center gap-4">
              <span className="flex-1 font-medium">{m.full_name}</span>
              <span className="text-ink-3">{m.role === "owner" ? "Pronar" : "Recepsion"}</span>
              {!m.active && <Pill tone="bg-bad-soft text-bad">Joaktiv</Pill>}
              {m.user_id !== me.userId && (
                <form action={setStaffActive}>
                  <input type="hidden" name="userId" value={m.user_id} />
                  <input type="hidden" name="active" value={m.active ? "0" : "1"} />
                  <button className="btn btn-ghost !py-1.5">{m.active ? "Çaktivizo" : "Aktivizo"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={inviteStaff} className="mt-4 grid sm:grid-cols-[1fr_1fr_9rem_auto] gap-2 items-end">
          <label><span className="label">Emri</span><input className="field" name="full_name" required /></label>
          <label><span className="label">Email</span><input className="field" name="email" type="email" required /></label>
          <label><span className="label">Roli</span>
            <select className="field" name="role" defaultValue="reception"><option value="reception">Recepsion</option><option value="owner">Pronar</option></select>
          </label>
          <button className="btn btn-primary h-[46px]">Dërgo ftesën</button>
        </form>
      </section>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Njësitë</h2>
        <p className="text-sm text-ink-3 mt-1">Çmimet ditore dhe sezonale menaxhohen te Beds24. Çmimi këtu përdoret vetëm kur Beds24 nuk është i lidhur.</p>
        <div className="mt-3 divide-y divide-line">
          {(units ?? []).map((u) => (
            <form key={u.id} action={updateUnit} className="py-2.5 grid grid-cols-2 sm:grid-cols-[1.4fr_6rem_6rem_6rem_auto_auto_auto] gap-2 items-center text-sm">
              <input type="hidden" name="id" value={u.id} />
              <input className="field !py-1.5 col-span-2 sm:col-span-1" name="name" defaultValue={u.name} aria-label="Emri" />
              <input className="field !py-1.5" name="base_price" type="number" step="0.01" defaultValue={Number(u.base_price)} aria-label="Çmimi €" />
              <input className="field !py-1.5" name="max_guests" type="number" defaultValue={u.max_guests} aria-label="Persona" />
              <input className="field !py-1.5" name="size_m2" type="number" defaultValue={u.size_m2 ?? 0} aria-label="m²" />
              <label className="flex items-center gap-1.5"><input type="checkbox" name="has_balcony" defaultChecked={u.has_balcony} /> Ballkon</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={u.active} /> Aktive</label>
              <button className="btn btn-ghost !py-1.5">Ruaj</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
