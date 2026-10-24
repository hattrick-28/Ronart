import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { IS_DEMO } from "./demo";

export type StaffUser = { userId: string; email: string; name: string; role: "owner" | "reception" };

/** Every admin page and action calls this. The database enforces the same rules again (RLS + 2FA). */
/** One auth + staff lookup per request, shared by the layout and the page. */
const loadStaff = cache(async (): Promise<StaffUser> => {
  if (IS_DEMO) return { userId: "demo", email: "demo@ronart", name: "Dion Maloku", role: "owner" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/admin/login");
  if (claims.aal !== "aal2") redirect("/admin/mfa");
  const { data: staff } = await supabase
    .from("staff")
    .select("full_name, role, active")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (!staff || !staff.active) redirect("/admin/login?e=no_access");
  return { userId: claims.sub, email: String(claims.email ?? ""), name: staff.full_name, role: staff.role };
});

export async function requireStaff(opts: { owner?: boolean } = {}): Promise<StaffUser> {
  const me = await loadStaff();
  if (opts.owner && me.role !== "owner") redirect("/admin?err=" + encodeURIComponent("Vetëm pronari ka qasje këtu."));
  return me;
}
