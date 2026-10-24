import { dict, getLang } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const d = dict[lang];
  return (
    <>
      <SiteHeader d={d} lang={lang} />
      <main className="flex-1">{children}</main>
      <SiteFooter d={d} />
    </>
  );
}
