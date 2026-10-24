import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eur, shortDate } from "@/lib/format";
import { CHANNEL_LABEL, METHOD_LABEL, STATUS_LABEL, STATUS_TONE, Pill } from "@/lib/labels";
import { nightsBetween } from "@/lib/pricing";
import { Flash } from "@/components/admin/flash";
import { IdUpload } from "@/components/admin/id-upload";
import { DocActions } from "@/components/admin/doc-actions";
import { markRefunded, recordPayment, saveInternalNote, setBlacklist, setBookingStatus } from "../../../actions";

export default async function BookingDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("*, units(name, type), guests(id, full_name, email, phone, country, is_blacklisted, blacklist_reason, no_show_count)")
    .eq("id", id)
    .single();
  if (!b) notFound();
  const { data: payments } = await supabase
    .from("payments").select("id, amount, method, status, created_at, note, received_by, provider_ref")
    .eq("booking_id", id).order("created_at");
  const staffIds = [...new Set((payments ?? []).map((p) => p.received_by).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await supabase.from("staff").select("user_id, full_name").in("user_id", staffIds) : { data: [] };
  const staffName = (uid: string | null) => staff?.find((s) => s.user_id === uid)?.full_name ?? "";
  const guestIdForDocs = (b.guests as { id: string } | null)?.id;
  const { data: docRows } = guestIdForDocs
    ? await supabase.from("guest_documents").select("id, storage_path, kind, created_at").eq("guest_id", guestIdForDocs).order("created_at", { ascending: false })
    : { data: [] };
  const docs = await Promise.all(
    (docRows ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage.from("guest-ids").createSignedUrl(d.storage_path, 120);
      return { ...d, url: signed?.signedUrl ?? null, isPdf: d.storage_path.endsWith(".pdf") };
    }),
  );
  const KIND: Record<string, string> = { id_card: "Letërnjoftim", passport: "Pasaportë", driving_licence: "Patentë", other: "Dokument" };

  const g = b.guests as { id: string; full_name: string; email: string | null; phone: string | null; country: string | null; is_blacklisted: boolean; blacklist_reason: string | null; no_show_count: number } | null;
  const u = b.units as { name: string; type: string } | null;
  const due = Math.max(0, Number(b.total_amount) - Number(b.paid_amount));
  const nights = nightsBetween(b.check_in, b.check_out);
  const isChannel = b.channel === "booking" || b.channel === "airbnb";

  const actions: { to: string; label: string; tone: string }[] = [];
  if (b.status === "pending") actions.push({ to: "confirmed", label: "Konfirmo", tone: "btn-primary" });
  if (b.status === "confirmed") actions.push({ to: "checked_in", label: "Check-in", tone: "btn-primary" });
  if (b.status === "checked_in") actions.push({ to: "checked_out", label: "Check-out", tone: "btn-primary" });
  if (b.status === "confirmed") actions.push({ to: "no_show", label: "Nuk erdhi", tone: "btn-ghost" });
  if (["hold", "pending", "confirmed"].includes(b.status)) actions.push({ to: "cancelled", label: "Anulo", tone: "btn-danger" });

  return (
    <div className="max-w-5xl">
      <Flash ok={sp.ok} err={sp.err} />
      <Link href="/admin/bookings" className="text-sm text-ink-3 hover:text-ink">Rezervimet</Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-wall-deep">{b.ref}</h1>
        <Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill>
        <Pill tone="bg-milk-2 text-ink-2">{CHANNEL_LABEL[b.channel]}</Pill>
        {b.allow_overlap && <Pill tone="bg-bad text-white">Mbirezervim</Pill>}
        {b.needs_refund && <Pill tone="bg-bad text-white">Duhet rimbursim</Pill>}
      </div>
      {b.status === "pending" && b.confirm_deadline && (
        <p className="mt-2 text-sm text-warn">Anulohet automatikisht më {new Date(b.confirm_deadline).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade" })} nëse nuk konfirmohet.</p>
      )}
      {b.status === "hold" && b.hold_expires_at && (
        <p className="mt-2 text-sm text-warn">Mysafiri po paguan online. Dhoma lirohet më {new Date(b.hold_expires_at).toLocaleTimeString("sq-AL", { timeZone: "Europe/Belgrade" })} nëse pagesa nuk kryhet.</p>
      )}

      <div className="mt-6 grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="space-y-5">
          <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><dt className="text-ink-3">Njësia</dt><dd className="font-semibold">{u?.name}</dd></div>
              <div><dt className="text-ink-3">Datat</dt><dd className="font-semibold">{shortDate(b.check_in)} – {shortDate(b.check_out)} · {nights} netë</dd></div>
              <div><dt className="text-ink-3">Persona</dt><dd>{b.adults} të rritur{b.children ? `, ${b.children} fëmijë` : ""}</dd></div>
              <div><dt className="text-ink-3">Mënyra e pagesës</dt><dd>{{ full: "E plotë online", deposit: "Depozitë online + pjesa tjetër në ardhje", on_arrival: "Në ardhje", channel: "Nga platforma" }[b.payment_option as string]}</dd></div>
              {b.guest_note && <div className="sm:col-span-2"><dt className="text-ink-3">Kërkesa e mysafirit</dt><dd>{b.guest_note}</dd></div>}
            </dl>
            {actions.length > 0 && (
              <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-2">
                {actions.map((a) => (
                  <form key={a.to} action={setBookingStatus}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="to" value={a.to} />
                    <button className={`btn ${a.tone} btn-sm`}>{a.label}</button>
                  </form>
                ))}
              </div>
            )}
            {isChannel && <p className="mt-3 text-xs text-ink-3">Rezervim nga {CHANNEL_LABEL[b.channel]}: ndryshimet e datave dhe anulimet bëhen te platforma; këtu vijnë vetë.</p>}
          </section>

          <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Pagesat</h2>
              <p className="text-sm">Gjithsej <b>{eur(b.total_amount)}</b> · Paguar <b>{eur(b.paid_amount)}</b></p>
            </div>
            <ul className="mt-3 divide-y divide-line text-sm">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="py-2.5 flex flex-wrap gap-x-4 gap-y-0.5 items-center">
                  <span className="font-semibold w-24">{eur(p.amount)}</span>
                  <span className="flex-1">{METHOD_LABEL[p.method]}{p.received_by ? ` · ${staffName(p.received_by)}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="text-ink-3">{new Date(p.created_at).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <Pill tone={p.status === "succeeded" ? "bg-ok-soft text-ok" : p.status === "initiated" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad"}>
                    {{ succeeded: "Kryer", initiated: "Në pritje", failed: "Dështoi", refunded: "Rimbursuar" }[p.status as string]}
                  </Pill>
                </li>
              ))}
              {(payments ?? []).length === 0 && <li className="py-2.5 text-ink-3">Asnjë pagesë ende.</li>}
            </ul>
            {due > 0.009 && b.channel !== "airbnb" && !["cancelled", "no_show"].includes(b.status) && (
              <form action={recordPayment} className="mt-4 pt-4 border-t border-line grid grid-cols-2 sm:grid-cols-[7rem_11rem_1fr_auto] gap-2 items-end">
                <input type="hidden" name="bookingId" value={b.id} />
                <label><span className="label">Shuma (€)</span><input className="field" name="amount" type="number" step="0.01" min="0.01" defaultValue={due.toFixed(2)} required /></label>
                <label><span className="label">Mënyra</span>
                  <select className="field" name="method" defaultValue="cash">
                    <option value="cash">Para në dorë</option><option value="card_pos">Kartelë në POS</option><option value="bank_transfer">Transfertë bankare</option>
                  </select>
                </label>
                <label className="col-span-2 sm:col-span-1"><span className="label">Shënim</span><input className="field" name="note" maxLength={300} /></label>
                <button className="btn btn-primary col-span-2 sm:col-span-1">Regjistro pagesën</button>
              </form>
            )}
            {b.needs_refund && me.role === "owner" && (
              <form action={markRefunded} className="mt-4">
                <input type="hidden" name="bookingId" value={b.id} />
                <button className="btn btn-ghost btn-sm">Shëno si të rimbursuar</button>
              </form>
            )}
          </section>

          <section className="rounded-[var(--radius-panel)] bg-white border border-line p-5">
            <h2 className="font-display text-lg font-semibold">Shënim i brendshëm</h2>
            <form action={saveInternalNote} className="mt-3 space-y-2">
              <input type="hidden" name="bookingId" value={b.id} />
              <textarea className="field min-h-24" name="note" defaultValue={b.internal_note ?? ""} maxLength={2000} />
              <button className="btn btn-ghost btn-sm">Ruaj shënimin</button>
            </form>
          </section>
        </div>

        <aside className="rounded-[var(--radius-panel)] bg-white border border-line p-5 text-sm space-y-2">
          <h2 className="font-display text-lg font-semibold">Mysafiri</h2>
          <p className="font-semibold text-base">{g?.full_name}</p>
          {g?.phone && <p><a className="underline" href={`tel:${g.phone}`}>{g.phone}</a></p>}
          {g?.email && <p className="break-all"><a className="underline" href={`mailto:${g.email}`}>{g.email}</a></p>}
          {g?.country && <p className="text-ink-2">{g.country}</p>}
          {(g?.no_show_count ?? 0) > 0 && <p className="text-bad">Nuk është paraqitur {g!.no_show_count} herë më parë.</p>}
          {g && (
            <div className="pt-3 border-t border-line space-y-3">
              <p className="font-semibold">Dokumenti i identifikimit</p>
              {docs.length > 0 && (
                <ul className="grid grid-cols-1 gap-3">
                  {docs.map((d) => (
                    <li key={d.id}>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line overflow-hidden hover:border-wall">
                          {d.isPdf ? (
                            <span className="grid place-items-center h-32 bg-milk-2 text-xs font-semibold">PDF</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.url} alt={KIND[d.kind]} className="h-32 w-full object-cover" />
                          )}
                          <span className="block px-2 py-1 text-xs text-ink-2">{KIND[d.kind]} · {new Date(d.created_at).toLocaleDateString("sq-AL")}</span>
                        </a>
                      ) : null}
                      <DocActions docId={d.id} bookingId={b.id} guestId={g.id} kind={d.kind} />
                    </li>
                  ))}
                </ul>
              )}
              <IdUpload guestId={g.id} bookingId={b.id} />
              <p className="text-xs text-ink-3">Ruhet në hapësirë private. E shohin vetëm stafi me kod nga telefoni; lidhja skadon pas 2 minutash. Fshihet vetë pas largimit sipas rregullës te Cilësimet.</p>
            </div>
          )}
          {g && (
            <form action={setBlacklist} className="pt-3 border-t border-line space-y-2">
              <input type="hidden" name="guestId" value={g.id} />
              <input type="hidden" name="back" value={`/admin/bookings/${b.id}`} />
              {g.is_blacklisted ? (
                <>
                  <p className="text-bad">I bllokuar: {g.blacklist_reason}</p>
                  <input type="hidden" name="on" value="0" />
                  <button className="btn btn-ghost btn-sm w-full">Hiq bllokimin</button>
                </>
              ) : (
                <>
                  <input type="hidden" name="on" value="1" />
                  <input className="field" name="reason" placeholder="Arsyeja e bllokimit" maxLength={300} />
                  <button className="btn btn-danger btn-sm w-full">Blloko rezervimet online</button>
                </>
              )}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
