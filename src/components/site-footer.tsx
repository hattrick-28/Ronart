import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { Wordmark } from "./site/arrow";

export function SiteFooter({ d }: { d: Dict }) {
  return (
    <footer className="s-foot">
      <div className="s-seam" aria-hidden="true"><div className="s-seam__line" data-seam /></div>
      <div className="s-wrap">
        <p className="s-foot__word" aria-hidden="true"><Wordmark /></p>
        <div className="s-foot__row">
          <span>© {new Date().getFullYear()} {SITE.company} · <a href={SITE.phoneHref}>{SITE.phone}</a></span>
          <nav aria-label={d.footer_terms}>
            <Link href="/terms">{d.footer_terms}</Link>
            <Link href="/cancellation">{d.footer_cancel}</Link>
            <Link href="/privacy">{d.footer_privacy}</Link>
            <Link href="/admin" rel="nofollow">{d.staff}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
