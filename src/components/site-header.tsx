import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";

export function SiteHeader({ d, lang }: { d: Dict; lang: Lang }) {
  const other = lang === "sq" ? "en" : "sq";
  return (
    <header className="bg-milk/95 backdrop-blur border-b border-line sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="font-display text-[1.45rem] font-semibold tracking-tight text-wall-deep">
          Ronart
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-[0.92rem] text-ink-2">
          <Link href="/rooms" className="hover:text-ink">{d.nav_rooms}</Link>
          <Link href="/#how" className="hover:text-ink">{d.nav_how}</Link>
          <Link href="/#contact" className="hover:text-ink">{d.nav_contact}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <a
            href={`/lang?to=${other}`}
            className="text-sm font-semibold text-ink-2 hover:text-ink px-2 py-1"
            aria-label={other === "en" ? "Switch to English" : "Kalo në shqip"}
          >
            {other.toUpperCase()}
          </a>
          <Link href="/rooms" className="btn btn-primary !py-2 !px-4 text-sm">{d.nav_book}</Link>
        </div>
      </div>
    </header>
  );
}
