"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "@/app/admin/actions";
import { IdUpload } from "./id-upload";

export function DocActions({ docId, bookingId, guestId, kind }: { docId: string; bookingId: string; guestId: string; kind: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await deleteDocument({ docId, bookingId });
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <p className="basis-full text-xs text-bad">Ta fshij përfundimisht?</p>
        <button type="button" className="btn btn-danger btn-sm flex-1" disabled={busy} onClick={remove}>{busy ? "…" : "Po, fshije"}</button>
        <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => setConfirming(false)}>Jo</button>
        {error && <p role="alert" className="basis-full text-xs text-bad">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      <IdUpload guestId={guestId} bookingId={bookingId} replaceDocId={docId} replaceKind={kind} compact />
      <button type="button" className="btn btn-ghost btn-sm flex-1 !text-bad" onClick={() => setConfirming(true)}>Fshij</button>
    </div>
  );
}
