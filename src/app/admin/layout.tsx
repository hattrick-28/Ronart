import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Paneli", template: "%s · Ronart Paneli" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-milk">{children}</div>;
}
