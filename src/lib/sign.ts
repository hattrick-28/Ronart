import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set (32+ chars)");
  return s;
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verify(value: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  return safeEqual(sign(value), signature);
}

export function hashKey(value: string): string {
  return createHmac("sha256", secret()).update("rl:" + value).digest("hex").slice(0, 32);
}
