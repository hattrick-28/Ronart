import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { IS_DEMO } from "../demo";
import { demoClient } from "./demo-client";

function realClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component; proxy refreshes the session */
          }
        },
      },
    },
  );
}

/** Supabase client acting as the signed-in staff member (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  if (IS_DEMO) return demoClient() as unknown as ReturnType<typeof realClient>;
  return realClient(cookieStore);
}
