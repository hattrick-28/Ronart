import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isTestPayments } from "@/lib/payments";
import { sign, verify } from "@/lib/sign";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** Stands in for NLB's hosted payment page while there are no bank credentials. */
export default async function TestPay({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isTestPayments()) notFound();
  const { pid = "", amt = "", ref = "", sig } = await searchParams;
  if (!verify(`mock:${pid}:${amt}`, sig)) notFound();
  const s = sign(`mock:${pid}:${amt}`);
  return (
    <main className="min-h-screen grid place-items-center bg-milk-2 px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] bg-white border border-line p-6 shadow-sm">
        <p className="inline-block rounded-full bg-warn-soft text-warn text-xs font-semibold px-3 py-1">TEST MODE – no real money</p>
        <p className="mt-4 text-sm text-ink-2">NLB · Pagesë e sigurt (simulim)</p>
        <p className="font-display text-3xl font-semibold mt-1">€{amt}</p>
        <p className="text-sm text-ink-3">{ref}</p>
        <div className="mt-6 grid gap-2">
          {(["success", "fail"] as const).map((outcome) => (
            <form key={outcome} action="/api/payments/test" method="post">
              <input type="hidden" name="pid" value={pid} />
              <input type="hidden" name="amt" value={amt} />
              <input type="hidden" name="sig" value={s} />
              <input type="hidden" name="outcome" value={outcome} />
              <button className={`btn w-full ${outcome === "success" ? "btn-primary" : "btn-ghost"}`}>
                {outcome === "success" ? "Simulate successful payment" : "Simulate failed payment"}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
