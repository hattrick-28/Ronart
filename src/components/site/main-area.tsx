"use client";

import { usePathname } from "next/navigation";

/** The home page starts under the floating header; every other page leaves room for it. */
export function MainArea({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/";
  return <main id="main" tabIndex={-1} className={`s-main${home ? " s-main--home" : ""}`}>{children}</main>;
}
