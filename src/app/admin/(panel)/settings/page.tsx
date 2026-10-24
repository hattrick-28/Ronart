import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { Flash } from "@/components/admin/flash";
import { Pill } from "@/lib/labels";
import { inviteStaff, setStaffActive, updateSettings, updateUnit } from "../../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff({ owner: true });
  const sp = await searchParams;
  const supabase = await createClient();
  const [s, { data: units }, { data: staff }] = await Promise.all([
    getSettings(),
    supabase.from("units").select("id, code, name, max_guests, size_m2, has_balcony, active").order("sort"),
    supabase.from("staff").select("user_id, full_name, role, active").order("created_at"),
  ]);
  
  const field = (k: keyof typeof s, label: string, hint: string) => (
    <label key={k}><span className="label">{label}</span>
      <input className="field" name={k} defaultValue={String(s[k])} />
      <span className="block text-xs text-ink-3 mt-1 leading-snug">{hint}</span>
    </label>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <Flash ok={sp.ok} err={sp.err} />
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Cilësimet</h1>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Rregullat e rezervimit</h2>
        <p className="text-sm text-ink-3 mt-1">Këto rregulla vlejnë për faqen tuaj dhe panelin. Oraret e check-in/out dërgohen edhe te kanalet.</p>
        <form action={updateSettings} className="mt-4 grid sm:grid-cols-3 gap-4">
          {field("hold_minutes", "Mbajtja gjatë pagesës (min)", "Sa minuta mbahet dhoma kur mysafiri është te pagesa. Pas kësaj lirohet vetë.")}
          {field("full_payment_discount_pct", "Zbritja për pagesë të plotë (%)", "Zbritja që sheh mysafiri në faqe kur paguan gjithçka online.")}
          {field("free_cancellation_days", "Anulim falas deri (ditë para)", "Shfaqet në faqe dhe në kushtet e anulimit.")}
          {field("phone_confirm_hours", "Afati për konfirmim me telefon (orë)", "Rezervimet me telefon “pa konfirmuar” anulohen vetë pas kësaj kohe.")}
          {field("max_active_bookings_per_contact", "Maks. rezervime aktive për një mysafir", "Ndalon që dikush të zërë shumë dhoma online pa ardhur.")}
          {field("check_in_time", "Check-in nga ora", "Shfaqet në faqe dhe në konfirmim.")}
          {field("check_out_time", "Check-out deri në orën", "Shfaqet në faqe dhe në konfirmim.")}
          {field("id_doc_retention_days", "Fshirja e letërnjoftimeve (ditë)", "Fotot e dokumenteve fshihen vetë kaq ditë pas largimit të mysafirit.")}
          {field("guest_data_retention_years", "Anonimizimi i mysafirëve (vjet)", "Emri, telefoni dhe emaili fshihen kaq vjet pas qëndrimit të fundit. Rezervimet dhe pagesat mbeten për kontabilitet.")}
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
                  <button className="btn btn-ghost btn-sm">{m.active ? "Çaktivizo" : "Aktivizo"}</button>
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
          <button className="btn btn-primary">Dërgo ftesën</button>
        </form>
      </section>

      <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
        <h2 className="font-display text-lg font-semibold">Njësitë</h2>
        <p className="text-sm text-ink-3 mt-1">Çmimet ndryshohen vetëm te <Link className="underline" href="/admin/prices">Çmimet</Link>. Emri dhe numri i personave dërgohen edhe te menaxheri i kanaleve; emri publik në Booking.com/Airbnb ndryshohet te ata.</p>
        <div className="mt-3 hidden sm:grid grid-cols-[1.4fr_6rem_6rem_auto_auto_auto] gap-2 text-xs font-semibold text-ink-3 px-0.5">
          <span>Emri</span><span>Persona</span><span>Madhësia m²</span><span className="w-[4.6rem]" /><span className="w-[4.2rem]" /><span className="w-[3.6rem]" />
        </div>
        <div className="mt-1 divide-y divide-line">
          {(units ?? []).map((u) => (
            <form key={u.id} action={updateUnit} className="py-2.5 grid grid-cols-2 sm:grid-cols-[1.4fr_6rem_6rem_auto_auto_auto] gap-2 items-center text-sm">
              <input type="hidden" name="id" value={u.id} />
              <input className="field field-sm col-span-2 sm:col-span-1" name="name" defaultValue={u.name} aria-label="Emri" />
              <input className="field field-sm" name="max_guests" type="number" defaultValue={u.max_guests} aria-label="Persona" />
              <input className="field field-sm" name="size_m2" type="number" defaultValue={u.size_m2 ?? 0} aria-label="m²" />
              <label className="flex items-center gap-1.5"><input type="checkbox" name="has_balcony" defaultChecked={u.has_balcony} /> Ballkon</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={u.active} /> Aktive</label>
              <button className="btn btn-ghost btn-sm">Ruaj</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
