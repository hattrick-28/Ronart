import "server-only";
import { createAdminClient } from "./supabase/admin";
import { hashKey } from "./sign";

/** Simple sliding-window limit stored in Postgres. Returns true if allowed. */
export async function rateLimit(bucket: string, key: string, max: number, windowSeconds: number) {
  const db = createAdminClient();
  const key_hash = hashKey(bucket + ":" + key);
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await db
    .from("rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key_hash", key_hash)
    .gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await db.from("rate_events").insert({ bucket, key_hash });
  return true;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
