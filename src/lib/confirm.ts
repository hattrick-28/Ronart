import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { VerifiedCallback } from "./payments";
import { pushBooking } from "./sync";

export async function applyVerifiedPayment(v: VerifiedCallback) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("confirm_online_payment", {
    p_payment_id: v.paymentId,
    p_provider_ref: v.providerRef,
    p_amount: v.amount,
    p_success: v.success,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0] as { booking_id: string | null; outcome: string } | undefined;
  if (row?.booking_id) {
    try {
      await pushBooking(row.booking_id);
    } catch (e) {
      console.error("beds24 push after payment failed; cron will retry", e);
    }
  }
  return row;
}
