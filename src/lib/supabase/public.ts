import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Anonymous client for public data (units). RLS limits it to active units. */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}
