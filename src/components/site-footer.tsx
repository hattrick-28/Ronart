import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function SiteFooter({ d }: { d: Dict }) {
  return (
    <footer id="contact" className="wall-texture text-milk mt-auto">
      <div className="glow-strip" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold">Ronart</p>
          <p className="mt-2 text-sm text-milk/75 max-w-xs">{SITE.address}</p>
        </div>
        <div className="text-sm space-y-1.5">
          <p className="text-milk/60">{d.nav_contact}</p>
          <p><a href={SITE.phoneHref} className="hover:underline">{SITE.phone}</a></p>
          <p><a href={`mailto:${SITE.email}`} className="hover:underline">{SITE.email}</a></p>
        </div>
        <div className="text-sm space-y-1.5">
          <p><Link href="/terms" className="hover:underline">{d.footer_terms}</Link></p>
          <p><Link href="/cancellation" className="hover:underline">{d.footer_cancel}</Link></p>
          <p><Link href="/privacy" className="hover:underline">{d.footer_privacy}</Link></p>
          <p className="pt-3"><Link href="/admin" className="text-milk/50 hover:text-milk" rel="nofollow">{d.staff}</Link></p>
        </div>
      </div>
      <div className="border-t border-white/10 text-xs text-milk/50 py-4 text-center">
        © {new Date().getFullYear()} {SITE.company}
      </div>
    </footer>
  );
}
