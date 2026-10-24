import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";

const PAGES = ["terms", "cancellation", "privacy"] as const;
type Page = (typeof PAGES)[number];

export function generateStaticParams() {
  return PAGES.map((legal) => ({ legal }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }): Promise<Metadata> {
  const { legal } = await params;
  return { title: { terms: "Kushtet", cancellation: "Anulimi", privacy: "Privatësia" }[legal as Page] };
}

export default async function LegalPage({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  if (!PAGES.includes(legal as Page)) notFound();
  const lang = await getLang();
  const s = await getSettings();
  const sq = lang === "sq";

  const content: Record<Page, { title: string; body: string[] }> = {
    terms: {
      title: sq ? "Kushtet e rezervimit" : "Booking terms",
      body: sq
        ? [
            `Rezervimi bëhet me ${SITE.company}. Rezervimi konfirmohet vetëm pasi pagesa online kryhet me sukses.`,
            `Dhoma mbahet për ${s.hold_minutes} minuta gjatë pagesës. Nëse pagesa nuk kryhet në këtë kohë, rezervimi anulohet automatikisht.`,
            `Check-in nga ora ${s.check_in_time}, check-out deri në orën ${s.check_out_time}. Në ardhje kërkohet dokument identifikimi.`,
            "Me opsionin e depozitës, pjesa e mbetur paguhet në recepsion në ardhje, me para në dorë ose kartelë.",
            `Për pyetje: ${SITE.phone}, ${SITE.email}.`,
          ]
        : [
            `You are booking with ${SITE.company}. A booking is confirmed only after the online payment succeeds.`,
            `We hold the room for ${s.hold_minutes} minutes while you pay. If payment isn't completed in that time, the booking is cancelled automatically.`,
            `Check-in from ${s.check_in_time}, check-out by ${s.check_out_time}. A photo ID is required on arrival.`,
            "With the deposit option, the rest is paid at reception on arrival, in cash or by card.",
            `Questions: ${SITE.phone}, ${SITE.email}.`,
          ],
    },
    cancellation: {
      title: sq ? "Politika e anulimit" : "Cancellation policy",
      body: sq
        ? [
            `Anulim falas deri në ${s.free_cancellation_days} ditë para datës së ardhjes. Shuma e paguar kthehet në të njëjtën kartelë.`,
            `Anulimet më vonë se ${s.free_cancellation_days} ditë para ardhjes, ose mosparaqitja, nuk rimbursohen: mbahet depozita (nata e parë), ose nata e parë nga pagesa e plotë.`,
            "Për të anuluar, na kontaktoni me numrin e rezervimit.",
          ]
        : [
            `Free cancellation up to ${s.free_cancellation_days} days before the arrival date. The amount paid is refunded to the same card.`,
            `Cancellations later than ${s.free_cancellation_days} days before arrival, or no-shows, are not refunded: we keep the deposit (first night), or the first night from a full payment.`,
            "To cancel, contact us with your booking number.",
          ],
    },
    privacy: {
      title: sq ? "Privatësia" : "Privacy",
      body: sq
        ? [
            "Mbledhim vetëm të dhënat e nevojshme për rezervimin: emrin, emailin, telefonin, shtetin dhe datat e qëndrimit.",
            "Të dhënat e kartelës futen vetëm në faqen e sigurt të bankës NLB. Ne nuk i shohim dhe nuk i ruajmë.",
            "Të dhënat ruhen në serverë në BE dhe aksesohen vetëm nga stafi i autorizuar. Ndahen me Booking.com/Airbnb vetëm kur rezervoni përmes tyre.",
            `Në check-in mund t'ju kërkohet dokumenti i identifikimit. Kopja e tij ruhet vetëm për verifikim dhe fshihet automatikisht ${s.id_doc_retention_days} ditë pas largimit.`,
            `Emri, telefoni dhe emaili ruhen për rezervimin dhe kontabilitetin, dhe anonimizohen automatikisht ${s.guest_data_retention_years} vjet pas qëndrimit të fundit.`,
            "Baza ligjore: Ligji Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale (kontrata, detyrimet ligjore dhe interesi i ligjshëm).",
            `Mund të kërkoni kopjen, korrigjimin ose fshirjen e të dhënave tuaja në ${SITE.email}, dhe mund të ankoheni te Agjencia për Informim dhe Privatësi.`,
          ]
        : [
            "We collect only what a booking needs: name, email, phone, country and stay dates.",
            "Card details are entered only on NLB bank's secure page. We never see or store them.",
            "Data is stored on servers in the EU and accessed only by authorised staff. It is shared with Booking.com/Airbnb only when you book through them.",
            `At check-in we may ask for an ID document. The copy is used only to verify your identity and is deleted automatically ${s.id_doc_retention_days} days after departure.`,
            `Your name, phone and email are kept for the booking and accounting, and are anonymised automatically ${s.guest_data_retention_years} years after your last stay.`,
            "Legal basis: Kosovo Law No. 06/L-082 on Protection of Personal Data (contract, legal obligations and legitimate interest).",
            `You can request a copy, correction or deletion of your data at ${SITE.email}, and you can complain to the Information and Privacy Agency.`,
          ],
    },
  };
  const page = content[legal as Page];
  return (
    <article className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
      <h1 className="font-display text-4xl font-semibold text-wall-deep">{page.title}</h1>
      <div className="mt-6 space-y-4 text-[1.02rem] leading-relaxed text-ink-2">
        {page.body.map((p) => <p key={p}>{p}</p>)}
      </div>
      <p className="mt-10 text-xs text-ink-3">{sq ? "Draft. Duhet rishikuar nga pronari para publikimit." : "Draft. To be reviewed by the owner before launch."}</p>
    </article>
  );
}
