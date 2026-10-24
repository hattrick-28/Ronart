import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ronart Apartments", template: "%s · Ronart Apartments" },
  description: "13 apartments and 5 suites. Book directly with Ronart Apartments.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#22362b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
