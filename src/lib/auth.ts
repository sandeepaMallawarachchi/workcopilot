import "server-only";
import { redirect } from "next/navigation";
import { configured, supabase } from "./supabase/server";
export async function requireAdmin() {
  if (!configured()) redirect("/setup");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("workspace_id,email")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login?error=unauthorized");
  return {
    db,
    user,
    workspace: profile.workspace_id as string,
    email: profile.email as string,
  };
}
