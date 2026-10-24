import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Flash } from "@/components/admin/flash";
import { createManualBooking } from "../../../actions";

export default async function NewBooking({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, name, base_price, max_guests").eq("active", true).order("sort");
  const s = await getSettings();
  const today = todayISO();

  return (
    <div className="max-w-3xl">
      <Flash ok={sp.ok} err={sp.err} />
      <h1 className="font-display text-3xl font-semibold text-wall-deep">Rezervim i ri</h1>
      <p className="text-ink-2 mt-1">Për rezervime me telefon ose në recepsion. Dhoma mbyllet menjëherë në Booking.com dhe Airbnb.</p>
      <form action={createManualBooking} className="mt-6 space-y-6">
        <fieldset className="rounded-[var(--radius-panel)] bg-white border border-line p-5 grid sm:grid-cols-2 gap-4">
          <legend className="px-1 font-display font-semibold">Qëndrimi</legend>
          <label className="sm:col-span-2"><span className="label">Njësia</span>
            <select className="field" name="unitId" required defaultValue={sp.unit ?? ""}>
              <option value="" disabled>Zgjidh njësinë</option>
              {(units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} · €{Number(u.base_price)}/natë · deri {u.max_guests} persona</option>)}
            </select>
          </label>
          <label><span className="label">Ardhja</span><input className="field" type="date" name="checkIn" min={today} defaultValue={sp.in ?? today} required /></label>
          <label><span className="label">Largimi</span><input className="field" type="date" name="checkOut" min={addDays(today, 1)} defaultValue={sp.out ?? addDays(today, 1)} required /></label>
          <label><span className="label">Persona</span><input className="field" type="number" name="adults" min={1} max={10} defaultValue={2} required /></label>
          <label><span className="label">Çmimi gjithsej (€)</span><input className="field" type="number" name="total" min={0} step="0.01" required placeholder="p.sh. 110" /></label>
        </fieldset>

        <fieldset className="rounded-[var(--radius-panel)] bg-white border border-line p-5 grid sm:grid-cols-2 gap-4">
          <legend className="px-1 font-display font-semibold">Mysafiri</legend>
          <label className="sm:col-span-2"><span className="label">Emri dhe mbiemri</span><input className="field" name="fullName" required minLength={2} /></label>
          <label><span className="label">Telefoni</span><input className="field" name="phone" type="tel" required /></label>
          <label><span className="label">Email (opsionale)</span><input className="field" name="email" type="email" /></label>
        </fieldset>

        <fieldset className="rounded-[var(--radius-panel)] bg-white border border-line p-5 space-y-3">
          <legend className="px-1 font-display font-semibold">Si erdhi rezervimi</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="channel" value="phone" defaultChecked /> Me telefon</label>
            <label className="flex items-center gap-2"><input type="radio" name="channel" value="walkin" /> Në recepsion</label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="rounded-[var(--radius-field)] border border-line p-4 text-sm has-[:checked]:border-wall has-[:checked]:bg-wall-soft/50">
              <input type="radio" name="mode" value="pending" defaultChecked className="mr-2" />
              <b>Pa konfirmuar</b>
              <span className="block text-ink-2 mt-1">Anulohet vetë pas {s.phone_confirm_hours} orësh nëse mysafiri nuk konfirmon ose nuk paguan depozitë.</span>
            </label>
            <label className="rounded-[var(--radius-field)] border border-line p-4 text-sm has-[:checked]:border-wall has-[:checked]:bg-wall-soft/50">
              <input type="radio" name="mode" value="confirmed" className="mr-2" />
              <b>Konfirmuar</b>
              <span className="block text-ink-2 mt-1">Mysafir i njohur, ose depozita u pagua. Pagesën e regjistron në rezervim.</span>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="override" /> Mysafiri është në listën e bllokuar, por pronari e ka miratuar</label>
          <label className="block"><span className="label">Shënim i brendshëm</span><textarea className="field min-h-20" name="note" maxLength={1000} /></label>
        </fieldset>
        <button className="btn btn-primary">Krijo rezervimin</button>
      </form>
    </div>
  );
}
