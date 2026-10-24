import "server-only";
import { mockProvider } from "./mock";
import { nlbProvider } from "./nlb";

export type CreateSessionInput = {
  paymentId: string;
  bookingRef: string;
  amount: number;
  currency: "EUR";
  description: string;
  lang: "sq" | "en";
  customerEmail: string;
};

export type VerifiedCallback = {
  paymentId: string;
  providerRef: string;
  amount: number;
  success: boolean;
};

export interface PaymentProvider {
  name: string;
  /** Returns the URL the guest is sent to. Card details are entered ONLY on the gateway's page. */
  createSession(input: CreateSessionInput): Promise<{ redirectUrl: string }>;
  /** Verifies the gateway's signed server-to-server notification. Returns null if invalid. */
  verifyCallback(req: Request): Promise<VerifiedCallback | null>;
}

export function getPaymentProvider(): PaymentProvider {
  const p = process.env.PAYMENT_PROVIDER ?? "mock";
  if (p === "nlb") return nlbProvider;
  return mockProvider;
}

export const isTestPayments = () => (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";
