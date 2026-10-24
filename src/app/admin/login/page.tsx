"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("e") === "no_access" ? "Kjo llogari nuk ka qasje në panel. Kontakto pronarin." : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) {
      setError("Email ose fjalëkalim i gabuar.");
      return;
    }
    router.replace("/admin/mfa");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="label">Email</span>
        <input className="field" name="email" type="email" required autoComplete="username" />
      </label>
      <label className="block"><span className="label">Fjalëkalimi</span>
        <input className="field" name="password" type="password" required autoComplete="current-password" minLength={8} />
      </label>
      {error && <p role="alert" className="text-sm rounded-[var(--radius-field)] bg-bad-soft text-bad px-3 py-2">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "…" : "Hyr"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex wall-texture text-milk flex-col justify-end p-12">
        <p className="font-display text-5xl font-semibold">Ronart</p>
        <p className="mt-2 text-milk/70">Paneli i stafit</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <p className="font-display text-2xl font-semibold text-wall-deep lg:hidden mb-6">Ronart</p>
          <h1 className="font-display text-3xl font-semibold">Hyr në panel</h1>
          <p className="text-ink-2 mt-1 mb-6 text-sm">Pas fjalëkalimit kërkohet kodi nga telefoni.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </div>
    </main>
  );
}
