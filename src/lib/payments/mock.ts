import "server-only";
import type { PaymentProvider } from "./index";
import { sign, verify } from "../sign";

/**
 * TEST gateway. Simulates the bank page so the whole flow can be tested
 * before NLB credentials exist. Never leave this on for a public launch.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createSession({ paymentId, amount, bookingRef, lang }) {
    const amt = amount.toFixed(2);
    const qs = new URLSearchParams({ pid: paymentId, amt, ref: bookingRef, lang, sig: sign(`mock:${paymentId}:${amt}`) });
    return { redirectUrl: `/pay/test?${qs}` };
  },
  async verifyCallback(req) {
    const form = await req.formData();
    const pid = String(form.get("pid") ?? "");
    const amt = String(form.get("amt") ?? "");
    const outcome = String(form.get("outcome") ?? "");
    const sig = String(form.get("sig") ?? "");
    if (!verify(`mock:${pid}:${amt}`, sig)) return null;
    return {
      paymentId: pid,
      providerRef: `TEST-${Date.now()}`,
      amount: Number(amt),
      success: outcome === "success",
    };
  },
};
