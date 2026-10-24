import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") === "en" ? "en" : "sq";
  let back = "/";
  const ref = req.headers.get("referer");
  if (ref) {
    const r = new URL(ref);
    if (r.host === url.host) back = r.pathname + r.search;
  }
  const res = NextResponse.redirect(new URL(back, req.url), 303);
  res.cookies.set("lang", to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
