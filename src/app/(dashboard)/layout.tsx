import { requireAdmin } from "@/lib/auth";
import Shell from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, email, workspace } = await requireAdmin();
  const { data: s, error } = await db
    .from("agent_settings")
    .select("ai_enabled")
    .eq("workspace_id", workspace)
    .single();
  if (error) throw new Error("Settings could not be loaded");
  return (
    <Shell email={email} enabled={s.ai_enabled}>
      {children}
    </Shell>
  );
}
