import { requireAdmin } from "@/lib/auth";
import { integration } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Switch, Textarea } from "@/components/ui/form";
import {
  PageTitle,
  Panel,
  Badge,
  StatusBadge,
  PanelNote,
  ProviderIcon,
  date,
  assertData,
} from "@/components/ui";

export default async function Integrations() {
  const { db, workspace } = await requireAdmin();
  const { data, error } = await db
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspace);
  assertData(error);
  return (
    <>
      <PageTitle
        eyebrow="CONNECTED, WITH BOUNDARIES"
        title="Your tools. Your permission."
        description="Real answers start with real sources. Choose exactly what your agent can read."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {data?.map((connection) => (
          <Panel
            key={connection.id}
            title={connection.provider === "github" ? "GitHub" : "GitLab"}
          >
            <div className="flex items-start gap-4 px-5 pt-6 sm:px-6">
              <ProviderIcon provider={connection.provider} large />
              <div className="min-w-0">
                <StatusBadge status={connection.status} />
                <p className="mt-2 text-sm font-medium break-words text-ink">
                  {connection.account ?? "No account connected"}
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  Last verified: {date(connection.last_sync_at)}
                </p>
              </div>
            </div>
            {connection.error && (
              <p
                role="alert"
                className="mx-5 mt-5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs leading-6 text-danger sm:mx-6"
              >
                {connection.error}
              </p>
            )}
            <ActionForm
              action={integration}
              successMessage="Connection settings updated. Check the verification status above."
              className="p-5 sm:p-6 [&:has(input[name=all]:checked)_textarea]:pointer-events-none [&:has(input[name=all]:checked)_textarea]:opacity-40"
            >
              <input type="hidden" name="provider" value={connection.provider} />
              {connection.provider === "github" && (
                <div className="mb-5">
                  <Switch
                    name="all"
                    label="Allow all repositories"
                    description="Read any repository the GitHub App installation can access, including ones you add to it later. The list below is ignored while this is on."
                    defaultChecked={connection.allowed_repositories.includes("*")}
                  />
                </div>
              )}
              <Field
                label={`Authorized ${connection.provider === "github" ? "repositories" : "projects"}`}
                hint="One full path per line, up to 50. Leave empty to permit no repository reads. Each path is verified with the provider."
              >
                <Textarea
                  name="repositories"
                  defaultValue={connection.allowed_repositories
                    .filter((repo: string) => repo !== "*")
                    .join("\n")}
                  rows={4}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder={
                    connection.provider === "github"
                      ? "owner/repository"
                      : "group/project"
                  }
                />
              </Field>
              <div className="mt-6 flex flex-wrap gap-3">
                <SubmitButton name="operation" value="connect" pendingLabel="Verifying…">
                  Verify & save selection
                </SubmitButton>
                <SubmitButton
                  name="operation"
                  value="disconnect"
                  variant="secondary"
                  pendingLabel="Disconnecting…"
                  disabled={connection.status === "disconnected"}
                  confirmMessage="Disconnect this integration? The agent will lose access to its repositories."
                >
                  Disconnect
                </SubmitButton>
              </div>
            </ActionForm>
            <PanelNote>
              Credentials stay on the server. Your agent has read access only.
            </PanelNote>
          </Panel>
        ))}
      </div>
      <section aria-label="Future integrations" className="grid gap-4 md:grid-cols-3">
        {["Gmail", "Google Drive", "Google Calendar"].map((name) => (
          <article
            key={name}
            className="rounded-2xl border border-dashed border-border bg-surface/50 p-5"
          >
            <div className="flex items-center gap-3">
              <ProviderIcon provider={name} />
              <h2 className="text-sm font-semibold text-ink">{name}</h2>
            </div>
            <div className="mt-5">
              <Badge>Coming later</Badge>
              <p className="mt-3 text-xs leading-6 text-muted">
                More of your work, in one conversation.
              </p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
