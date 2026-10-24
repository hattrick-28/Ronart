import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";
import { signOut } from "../actions";
import { isTestPayments } from "@/lib/payments";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14rem_1fr]">
      <aside className="wall-texture text-milk lg:min-h-screen lg:sticky lg:top-0 lg:h-screen flex flex-col">
        <div className="px-4 pt-4 pb-3 lg:pt-6 flex items-center justify-between gap-3 lg:block">
          <div>
            <p className="font-display text-2xl font-semibold">Ronart</p>
            <p className="text-xs text-milk/60 lg:mt-0.5">{me.name} · {me.role === "owner" ? "Pronar" : "Recepsion"}</p>
          </div>
          <form action={signOut} className="lg:hidden">
            <button className="text-sm text-milk/70 hover:text-milk border border-white/20 rounded-full px-3 py-1">Dil</button>
          </form>
        </div>
        <div className="px-3 pb-3 lg:flex-1">
          <AdminNav owner={me.role === "owner"} />
        </div>
        <form action={signOut} className="hidden lg:block px-4 pb-5">
          <button className="text-sm text-milk/60 hover:text-milk">Dil</button>
        </form>
        <div className="glow-strip lg:hidden" />
      </aside>
      <div className="min-w-0 px-4 sm:px-8 py-6 sm:py-8">
        {me.role === "owner" && isTestPayments() && (
          <p className="mb-5 rounded-[var(--radius-field)] bg-warn-soft text-warn px-4 py-2.5 text-sm">
            Pagesat online janë në modalitet testi derisa të lidhet banka NLB. Faqja nuk duhet hapur për publikun ende.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
