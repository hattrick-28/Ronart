import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type StaffUser = { userId: string; email: string; name: string; role: "owner" | "reception" };

/** Every admin page and action calls this. The database enforces the same rules again (RLS + 2FA). */
export async function requireStaff(opts: { owner?: boolean } = {}): Promise<StaffUser> {
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
  if (opts.owner && staff.role !== "owner") redirect("/admin?e=owner_only");
  return { userId: claims.sub, email: String(claims.email ?? ""), name: staff.full_name, role: staff.role };
}
