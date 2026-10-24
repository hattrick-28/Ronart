import "server-only";
import type { PaymentProvider } from "./index";

/**
 * NLB e-commerce gateway.
 *
 * Fill this in from the integration document NLB sends with your merchant account.
 * Banks in the region typically use a hosted payment page with 3-D Secure:
 *   1. createSession: build the signed request (merchant id, terminal id, order id = paymentId,
 *      amount, currency 978 = EUR, success/fail URLs, notification URL) and return the gateway URL.
 *   2. verifyCallback: check the bank's signature/hash on the notification to
 *      /api/payments/callback, then return { paymentId, providerRef, amount, success }.
 * Rules: never trust the browser redirect alone; verify the signature and the amount;
 * card numbers must never touch this server.
 */
function notConfigured(): never {
  throw new Error("NLB payment gateway is not configured yet. Set PAYMENT_PROVIDER=mock until NLB credentials arrive.");
}

export const nlbProvider: PaymentProvider = {
  name: "nlb",
  async createSession() {
    if (!process.env.NLB_MERCHANT_ID || !process.env.NLB_SECRET || !process.env.NLB_GATEWAY_URL) notConfigured();
    notConfigured();
  },
  async verifyCallback() {
    return null;
  },
};
