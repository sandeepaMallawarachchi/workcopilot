import { availableRepositories } from "@/lib/integrations/available";
import {
  CODES_TASK,
  SENT_TASK,
  availableTasks,
  type Task,
} from "../../../packages/agent-core/src/services/shortcuts";

// The dashboard's admin Supabase client (typed loosely to avoid coupling here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Tasks that exist right now, so access can only be granted to real things. */
export async function taskOptions(db: Db, workspace: string): Promise<Task[]> {
  const [{ data: integrations }, { data: mailboxes }, { data: settings }] =
    await Promise.all([
      db
        .from("integrations")
        .select("provider,status,capabilities")
        .eq("workspace_id", workspace),
      db.from("mailboxes").select("id").eq("workspace_id", workspace),
      db
        .from("agent_settings")
        .select("verification_codes_enabled,email_sent_enabled")
        .eq("workspace_id", workspace)
        .single(),
    ]);
  const caps = (provider: string) => {
    const row = integrations?.find(
      (i: { provider: string; status: string }) =>
        i.provider === provider && i.status === "connected",
    );
    return row
      ? ((row.capabilities as string[] | null) ?? [
          "code",
          "commits",
          "issues",
          "pull_requests",
          "pipelines",
        ])
      : null;
  };
  const hasMail = (mailboxes?.length ?? 0) > 0;
  return [
    ...availableTasks({ github: caps("github"), gitlab: caps("gitlab"), email: hasMail }),
    ...(hasMail && settings?.email_sent_enabled ? [SENT_TASK] : []),
    ...(hasMail && settings?.verification_codes_enabled ? [CODES_TASK] : []),
  ];
}

/** Repositories, projects and mailboxes a contact's access can be narrowed to. */
export async function resourceOptions(db: Db, workspace: string) {
  const [{ data: integrations }, { data: mailboxes }] = await Promise.all([
    db
      .from("integrations")
      .select("provider,status,allowed_repositories")
      .eq("workspace_id", workspace),
    db
      .from("mailboxes")
      .select("id,label,address")
      .eq("workspace_id", workspace)
      .order("created_at"),
  ]);
  const list = async (provider: "github" | "gitlab") => {
    const row = integrations?.find(
      (i: { provider: string; status: string }) =>
        i.provider === provider && i.status === "connected",
    );
    return row ? availableRepositories(provider, row.allowed_repositories ?? []) : null;
  };
  const [github, gitlab] = await Promise.all([list("github"), list("gitlab")]);
  return {
    github,
    gitlab,
    mailboxes: (mailboxes ?? []) as { id: string; label: string; address: string }[],
  };
}
export type ResourceOptions = Awaited<ReturnType<typeof resourceOptions>>;
