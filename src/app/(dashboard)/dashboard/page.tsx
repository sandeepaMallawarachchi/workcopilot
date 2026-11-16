import { CheckCheck, MessageSquare, TriangleAlert, Users, Workflow } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { AgentHero } from "@/components/dashboard/agent-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  PageTitle,
  Panel,
  Empty,
  StatusBadge,
  PanelNote,
  ProviderIcon,
  date,
  assertData,
} from "@/components/ui";
import { buttonStyles } from "@/components/ui/button";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default async function Dashboard() {
  const { db, workspace } = await requireAdmin();
  const results = await Promise.all([
    db
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace)
      .eq("active", true)
      .eq("ai_access", true),
    db
      .from("agent_jobs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace),
    db
      .from("agent_jobs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace)
      .eq("status", "completed"),
    db
      .from("agent_jobs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace)
      .in("status", ["dead", "manual_review"]),
    db
      .from("audit_logs")
      .select("*")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(6),
    db.from("integrations").select("*").eq("workspace_id", workspace),
    db.from("agent_settings").select("*").eq("workspace_id", workspace).single(),
  ]);
  results.forEach((x) => assertData(x.error));
  const [contacts, jobs, success, failed, activity, integrations, settings] = results;
  const s = settings.data;
  return (
    <>
      <PageTitle
        eyebrow="YOUR AGENT, AT A GLANCE"
        title="A little less busywork."
        description="Your personal assistant. Connected to your work, right inside WhatsApp."
      >
        <Link href="/settings" className={buttonStyles({ variant: "secondary" })}>
          Agent settings <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </PageTitle>
      <AgentHero enabled={s?.ai_enabled ?? false} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Authorized contacts"
          value={contacts.count ?? 0}
          description="Only people you choose"
          icon={Users}
          href="/contacts"
        />
        <StatCard
          label="Requests received"
          value={jobs.count ?? 0}
          description="Explicitly activated messages"
          icon={MessageSquare}
          href="/conversations"
        />
        <StatCard
          label="Replies sent"
          value={success.count ?? 0}
          description="Completed deliveries"
          icon={CheckCheck}
          href="/activity"
        />
        <StatCard
          label="Needs attention"
          value={failed.count ?? 0}
          description="Failed or uncertain delivery"
          icon={TriangleAlert}
          href="/activity"
        />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Recent activity" href="/activity">
          {!activity.data?.length ? (
            <Empty
              title="A quiet start"
              description="Your agent activity will appear here after your first authorized request."
            />
          ) : (
            <ul className="divide-y divide-border px-5 sm:px-6">
              {activity.data.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"
                  >
                    <Workflow size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold break-words text-ink">
                      {item.event.replaceAll(".", " · ").replaceAll("_", " ")}
                    </p>
                    <time
                      dateTime={item.created_at}
                      className="mt-1 block text-[11px] text-muted"
                    >
                      {date(item.created_at)}
                    </time>
                  </div>
                  <StatusBadge status={item.event.split(".").at(-1) ?? item.event} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Connected tools" href="/integrations">
          <ul className="divide-y divide-border px-5 sm:px-6">
            {integrations.data?.map((connection) => (
              <li key={connection.id} className="flex flex-wrap items-center gap-3 py-5">
                <ProviderIcon provider={connection.provider} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">
                    {connection.provider === "github" ? "GitHub" : "GitLab"}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted">
                    {connection.allowed_repositories.includes("*")
                      ? "All installation repositories"
                      : `${connection.allowed_repositories.length} authorized repositories`}
                  </p>
                </div>
                <StatusBadge status={connection.status} />
              </li>
            ))}
          </ul>
          <PanelNote>
            Connections only read from repositories you explicitly authorize.
          </PanelNote>
        </Panel>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2 text-center text-xs leading-6 text-muted">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        <strong className="font-semibold text-ink">Private by default.</strong> Ordinary
        WhatsApp messages never enter your AI history.
      </p>
    </>
  );
}
