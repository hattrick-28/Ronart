import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client with the secret key. Bypasses RLS, so only use it
 * in code paths that have already validated input (captcha, rate limit, signatures).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
