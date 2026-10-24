"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string };

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace("/admin");
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setMode({ kind: "verify", factorId: verified.id });
        return;
      }
      // remove half-finished enrolments, then start a new one
      for (const f of factors?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Ronart " + Date.now() });
      if (error || !data) {
        setError("Nuk u nis dot verifikimi me dy hapa. Rifresko faqen.");
        return;
      }
      setMode({ kind: "enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode.kind === "loading") return;
    setBusy(true);
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    setBusy(false);
    if (error) {
      setError("Kodi nuk është i saktë ose ka skaduar. Provo kodin e ri.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-semibold">Kodi nga telefoni</h1>
        {mode.kind === "loading" && <p className="mt-4 text-ink-2">Duke u ngarkuar…</p>}
        {mode.kind === "enroll" && (
          <div className="mt-3 text-sm text-ink-2 space-y-3">
            <p>Hera e parë: hap Google Authenticator ose Microsoft Authenticator dhe skano këtë kod.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mode.qr} alt="Kodi QR për aplikacionin e verifikimit" className="w-48 h-48 bg-white p-2 rounded-xl border border-line" />
            <p>Ose shkruaj kodin: <code className="font-semibold break-all text-ink">{mode.secret}</code></p>
          </div>
        )}
        {mode.kind === "verify" && <p className="mt-3 text-sm text-ink-2">Shkruaj kodin 6-shifror nga aplikacioni i verifikimit.</p>}
        {mode.kind !== "loading" && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <input className="field text-center text-2xl tracking-[0.4em] font-semibold" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
            {error && <p role="alert" className="text-sm rounded-[var(--radius-field)] bg-bad-soft text-bad px-3 py-2">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "…" : "Verifiko"}</button>
          </form>
        )}
        <button onClick={signOut} className="mt-6 text-sm text-ink-3 hover:text-ink underline">Dil</button>
      </div>
    </main>
  );
}
