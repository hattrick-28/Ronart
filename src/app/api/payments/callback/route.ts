import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { applyVerifiedPayment } from "@/lib/confirm";

/** Server-to-server notification from the bank. Only signed notifications are accepted. */
export async function POST(req: Request) {
  const provider = getPaymentProvider();
  if (provider.name === "mock") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const verified = await provider.verifyCallback(req);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  const result = await applyVerifiedPayment(verified);
  return NextResponse.json({ ok: true, outcome: result?.outcome });
}
