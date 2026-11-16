import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { Badge, StatusBadge, ProviderIcon, date, assertData } from "@/components/ui";

const providers = [
  {
    id: "github",
    name: "GitHub",
    blurb: "Repositories, commits, issues and pull requests.",
  },
  {
    id: "gitlab",
    name: "GitLab",
    blurb: "Projects, commits, issues, merge requests and pipelines.",
  },
] as const;

function scopeSummary(provider: string, allowed: string[]) {
  if (allowed.includes("*"))
    return provider === "github" ? "All repositories" : "All projects";
  if (!allowed.length) return "None selected";
  const [one, many] =
    provider === "github" ? ["repository", "repositories"] : ["project", "projects"];
  return `${allowed.length} ${allowed.length === 1 ? one : many}`;
}

export default async function Integrations() {
  const { db, workspace } = await requireAdmin();
  const { data, error } = await db
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspace);
  assertData(error);
  const byProvider = new Map((data ?? []).map((row) => [row.provider, row]));

  return (
    <>
      <div>
        <h1 className="text-lg font-bold tracking-tight text-ink">Integrations</h1>
        <p className="mt-1 text-sm text-muted">
          Choose what your agent can read. Open a service to configure it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => {
          const row = byProvider.get(p.id);
          const blocked = (row?.blocked_paths ?? []).length;
          return (
            <Link
              key={p.id}
              href={`/integrations/${p.id}`}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <ProviderIcon provider={p.id} large />
                <StatusBadge status={row?.status ?? "disconnected"} />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-ink">{p.name}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{p.blurb}</p>
              <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Access</dt>
                  <dd className="text-right font-medium text-ink">
                    {scopeSummary(p.id, row?.allowed_repositories ?? [])}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Blocked paths</dt>
                  <dd className="text-right font-medium text-ink">
                    {blocked ? `Built-in + ${blocked} custom` : "Built-in only"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Last verified</dt>
                  <dd className="text-right text-ink">
                    {date(row?.last_sync_at ?? null)}
                  </dd>
                </div>
              </dl>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                Configure
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
            </Link>
          );
        })}

        {["Gmail", "Google Drive", "Google Calendar"].map((name) => (
          <article
            key={name}
            className="flex flex-col rounded-2xl border border-dashed border-border bg-surface/50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <ProviderIcon provider={name} large />
              <Badge>Coming later</Badge>
            </div>
            <h2 className="mt-4 text-sm font-semibold text-ink">{name}</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              More of your work, in one conversation.
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
