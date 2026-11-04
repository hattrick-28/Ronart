import { dict, getLang } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteMotion } from "@/components/site/motion";
import { MainArea } from "@/components/site/main-area";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./site.css";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const d = dict[lang];
  return (
    <div className="rn flex flex-col min-h-full flex-1">
      <SiteHeader d={d} lang={lang} />
      <MainArea>{children}</MainArea>
      <SiteFooter d={d} />
      <SiteMotion />
    </div>
  );
}
