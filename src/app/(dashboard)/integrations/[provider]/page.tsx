import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { integration, saveIntegrationAccess } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Switch, Textarea } from "@/components/ui/form";
import {
  Panel,
  PanelNote,
  StatusBadge,
  ProviderIcon,
  date,
  assertData,
} from "@/components/ui";
import {
  ALL_CAPABILITIES,
  BUILT_IN_BLOCKED,
  CAPABILITIES,
  SUGGESTED_BLOCKED,
} from "../../../../../packages/agent-core/src/security/access";

const meta = {
  github: {
    name: "GitHub",
    unit: "repositories",
    placeholder: "owner/repository",
    allLabel: "Allow all repositories",
    allHint:
      "Read any repository the GitHub App installation can access, including ones you add to it later. The list below is ignored while this is on.",
  },
  gitlab: {
    name: "GitLab",
    unit: "projects",
    placeholder: "group/project",
    allLabel: "Allow all projects",
    allHint:
      "Read any GitLab project the token's account is a member of, including ones you join later. The list below is ignored while this is on.",
  },
} as const;

export default async function IntegrationSettings({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  if (provider !== "github" && provider !== "gitlab") notFound();
  const info = meta[provider];

  const { db, workspace } = await requireAdmin();
  const { data: connection, error } = await db
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspace)
    .eq("provider", provider)
    .single();
  assertData(error);

  const allowed: string[] = connection.allowed_repositories ?? [];
  const capabilities: string[] = connection.capabilities ?? ALL_CAPABILITIES;
  const blocked: string[] = connection.blocked_paths ?? [];
  const visibleCapabilities = CAPABILITIES.filter(
    (c) => provider === "gitlab" || c.id !== "pipelines",
  );

  return (
    <>
      <div>
        <Link
          href="/integrations"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Integrations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <ProviderIcon provider={provider} large />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-ink">{info.name}</h1>
              <StatusBadge status={connection.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {connection.account ?? "No account connected"} · Last verified{" "}
              {date(connection.last_sync_at)}
            </p>
          </div>
        </div>
        {connection.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs leading-6 text-danger"
          >
            {connection.error}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title={`Which ${info.unit} the agent can read`}>
          <ActionForm
            action={integration}
            successMessage="Connection settings updated. Check the verification status above."
            className="p-5 sm:p-6 [&:has(input[name=all]:checked)_textarea]:pointer-events-none [&:has(input[name=all]:checked)_textarea]:opacity-40"
          >
            <input type="hidden" name="provider" value={provider} />
            <div className="mb-5">
              <Switch
                name="all"
                label={info.allLabel}
                description={info.allHint}
                defaultChecked={allowed.includes("*")}
              />
            </div>
            <Field
              label={`Selected ${info.unit}`}
              hint="One full path per line, up to 50. Each path is verified with the provider."
            >
              <Textarea
                name="repositories"
                defaultValue={allowed.filter((r) => r !== "*").join("\n")}
                rows={5}
                spellCheck={false}
                autoCapitalize="none"
                placeholder={info.placeholder}
              />
            </Field>
            <div className="mt-6 flex flex-wrap gap-3">
              <SubmitButton name="operation" value="connect" pendingLabel="Verifying…">
                Verify & save
              </SubmitButton>
              <SubmitButton
                name="operation"
                value="disconnect"
                variant="secondary"
                pendingLabel="Disconnecting…"
                disabled={connection.status === "disconnected"}
                confirmMessage="Disconnect this integration? The agent will lose access to it."
              >
                Disconnect
              </SubmitButton>
            </div>
          </ActionForm>
          <PanelNote>
            Credentials stay on the server. Your agent has read access only.
          </PanelNote>
        </Panel>

        <Panel title="What the agent can access">
          <ActionForm
            action={saveIntegrationAccess}
            successMessage="Agent access rules saved."
            className="space-y-6 p-5 sm:p-6"
          >
            <input type="hidden" name="provider" value={provider} />
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Allowed data</legend>
              <p className="mt-1 text-xs leading-5 text-muted">
                Turned-off kinds are never offered to the agent.
              </p>
              <div className="mt-3 space-y-2">
                {visibleCapabilities.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-canvas px-3.5 py-3 has-[:checked]:border-accent/30"
                  >
                    <input
                      type="checkbox"
                      name="capabilities"
                      value={c.id}
                      defaultChecked={capabilities.includes(c.id)}
                      className="mt-0.5 size-4.5 shrink-0 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        {c.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted">
                        {c.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <Field
                label="Blocked files and folders"
                hint="One pattern per line, like .gitignore: *.env, config/secrets/, docs/private/**. A name without a slash matches anywhere; a folder blocks everything inside it. Blocked files are hidden from listings and searches and can never be read."
              >
                <Textarea
                  name="blocked_paths"
                  defaultValue={blocked.join("\n")}
                  rows={5}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder={SUGGESTED_BLOCKED.join("\n")}
                />
              </Field>
              <div className="mt-3 rounded-xl border border-border bg-canvas p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Lock size={13} aria-hidden="true" /> Always blocked
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {BUILT_IN_BLOCKED.map((rule) => (
                    <li
                      key={rule}
                      className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <SubmitButton pendingLabel="Saving…">Save access rules</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
