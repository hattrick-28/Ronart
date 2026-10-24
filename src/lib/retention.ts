import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getSettings } from "./settings";

/**
 * Data minimisation under Kosovo Law No. 06/L-082 (storage limitation, Art. 4):
 * - ID document copies are deleted N days after the guest's last stay (owner sets N).
 * - Guest contact data is anonymised N years after the last stay; bookings and payments
 *   stay for accounting, but without name/phone/email.
 */
export async function runRetention() {
  const db = createAdminClient();
  const s = await getSettings();
  const out = { documentsDeleted: 0, guestsAnonymized: 0 };

  const { data: docs } = await db.rpc("documents_due_for_deletion", { p_days: s.id_doc_retention_days });
  const due = (docs ?? []) as { doc_id: string; storage_path: string }[];
  if (due.length) {
    await db.storage.from("guest-ids").remove(due.map((d) => d.storage_path));
    await db.from("guest_documents").delete().in("id", due.map((d) => d.doc_id));
    await db.from("audit_log").insert(due.map((d) => ({ action: "auto_delete", entity: "guest_documents", entity_id: d.doc_id, data: { reason: `retention ${s.id_doc_retention_days} days` } })));
    out.documentsDeleted = due.length;
  }

  const { data: guests } = await db.rpc("guests_due_for_anonymization", { p_years: s.guest_data_retention_years });
  const ids = ((guests ?? []) as { guest_id: string }[]).map((g) => g.guest_id);
  if (ids.length) {
    const { data: leftover } = await db.from("guest_documents").select("id, storage_path").in("guest_id", ids);
    if (leftover?.length) {
      await db.storage.from("guest-ids").remove(leftover.map((d) => d.storage_path));
      await db.from("guest_documents").delete().in("id", leftover.map((d) => d.id));
    }
    await db.from("guests").update({
      full_name: "Mysafir i anonimizuar", email: null, phone: null, country: null, notes: null,
      blacklist_reason: null, is_blacklisted: false, anonymized_at: new Date().toISOString(),
    }).in("id", ids);
    await db.from("audit_log").insert(ids.map((id) => ({ action: "auto_anonymize", entity: "guests", entity_id: id, data: { reason: `retention ${s.guest_data_retention_years} years` } })));
    out.guestsAnonymized = ids.length;
  }
  return out;
}
