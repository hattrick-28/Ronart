import { NextResponse } from "next/server";
import { mockProvider } from "@/lib/payments/mock";
import { isTestPayments } from "@/lib/payments";
import { applyVerifiedPayment } from "@/lib/confirm";
import { createAdminClient } from "@/lib/supabase/admin";
import { sign } from "@/lib/sign";

/** Receives the test gateway's form. Disabled as soon as a real provider is configured. */
export async function POST(req: Request) {
  if (!isTestPayments()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const verified = await mockProvider.verifyCallback(req);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  await applyVerifiedPayment(verified);
  const { data } = await createAdminClient()
    .from("payments").select("bookings(ref)").eq("id", verified.paymentId).single();
  const ref = (data?.bookings as unknown as { ref: string } | null)?.ref ?? "";
  const url = new URL(`/book/done?ref=${ref}&t=${sign("done:" + ref)}`, req.url);
  return NextResponse.redirect(url, 303);
}
