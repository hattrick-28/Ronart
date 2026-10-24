"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, registerDocument } from "@/app/admin/actions";

/** Shrinks a photo to max 1800px JPEG in the browser, so uploads are fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

export function IdUpload({ guestId, bookingId, replaceDocId, replaceKind, compact }: {
  guestId: string; bookingId: string; replaceDocId?: string; replaceKind?: string; compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(replaceKind ?? "id_card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 25 * 1024 * 1024) { setError("Skedari është shumë i madh."); return; }
    setBusy(true);
    try {
      const blob = await shrink(file);
      const isPdf = file.type === "application/pdf";
      const path = `${guestId}/${crypto.randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
      const { error: upErr } = await createClient().storage.from("guest-ids").upload(path, blob, {
        contentType: isPdf ? "application/pdf" : "image/jpeg",
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      const res = await registerDocument({ guestId, bookingId, path, kind });
      if (res?.error) throw new Error(res.error);
      if (replaceDocId) {
        const del = await deleteDocument({ docId: replaceDocId, bookingId });
        if (del?.error) throw new Error("Dokumenti i ri u ruajt, por i vjetri nuk u fshi: " + del.error);
      }
      router.refresh();
    } catch (err) {
      setError("Ngarkimi dështoi: " + (err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (compact) {
    return (
      <>
        <button type="button" className="btn btn-ghost btn-sm flex-1" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "…" : "Zëvendëso"}
        </button>
        <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={onFile} />
        {error && <p role="alert" className="basis-full text-xs text-bad">{error}</p>}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        <select className="field field-sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lloji i dokumentit">
          <option value="id_card">Letërnjoftim</option>
          <option value="passport">Pasaportë</option>
          <option value="driving_licence">Patentë</option>
          <option value="other">Tjetër</option>
        </select>
        <button type="button" className="btn btn-primary btn-sm w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Duke ngarkuar…" : "Fotografo / ngarko"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={onFile} />
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}
