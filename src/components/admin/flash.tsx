export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <p role={err ? "alert" : "status"} className={`mb-5 rounded-[var(--radius-field)] px-4 py-3 text-sm font-medium ${err ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
      {err ?? ok}
    </p>
  );
}
