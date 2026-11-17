import { requireAdmin } from "@/lib/auth";
import { updateContact } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Empty, Badge, assertData, WhatsAppIcon } from "@/components/ui";
import { AccessSummary } from "@/components/contacts/contact-access";
import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { storedResources } from "../../../../packages/agent-core/src/services/shortcuts";

export default async function Contacts() {
  const { db, workspace } = await requireAdmin();
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false });
  assertData(error);
  const usage = await db
    .from("conversations")
    .select("contact_id,messages(count)")
    .eq("workspace_id", workspace);
  assertData(usage.error);
  // Mailbox names for the access summary chips.
  const { data: mailboxes } = await db
    .from("mailboxes")
    .select("id,label,address")
    .eq("workspace_id", workspace)
    .order("created_at");
  const messageCount = (id: string) =>
    usage.data?.find((item) => item.contact_id === id)?.messages?.[0]?.count ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-ink">
            Contacts{data?.length ? ` · ${data.length}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Who can use your assistant, and which integrations each person can reach.
          </p>
        </div>
        <AddContactDialog />
      </div>

      {!data?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60">
          <Empty
            title="No contacts yet"
            description="Add your Meta-verified test recipient to get started."
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((contact) => {
            const operations = [
              {
                operation: "toggle",
                value: !contact.active,
                label: contact.active ? "Deactivate" : "Activate",
              },
              {
                operation: "access",
                value: !contact.ai_access,
                label: contact.ai_access ? "Revoke AI" : "Allow AI",
              },
              { operation: "delete", value: false, label: "Remove" },
            ] as const;
            return (
              <article
                key={contact.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent"
                  >
                    {initials(contact.display_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-ink">
                      {contact.display_name}
                    </h2>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted">
                      <WhatsAppIcon size={12} />
                      {contact.phone}
                    </p>
                  </div>
                  <Badge good={contact.active && contact.ai_access}>
                    {!contact.active
                      ? "Inactive"
                      : contact.ai_access
                        ? "AI allowed"
                        : "AI disabled"}
                  </Badge>
                </div>

                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-canvas/60 px-3 py-2.5 text-center text-[11px]">
                  <div>
                    <dt className="text-muted">Messages</dt>
                    <dd className="mt-0.5 font-semibold text-ink tabular-nums">
                      {messageCount(contact.id)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Language</dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink">
                      {contact.preferred_language ?? "Match"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Last active</dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink">
                      {contact.last_activity ? shortDate(contact.last_activity) : "—"}
                    </dd>
                  </div>
                </dl>

                <AccessSummary
                  contactId={contact.id}
                  name={contact.display_name}
                  access={contact.allowed_tasks ?? null}
                  canViewSecrets={contact.can_view_secrets === true}
                  resources={storedResources(contact.resources)}
                  mailboxes={mailboxes ?? []}
                />

                <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                  {operations.map(({ operation, value, label }) => (
                    <ActionForm
                      action={updateContact}
                      key={operation}
                      successMessage="Contact updated."
                      className={operation === "delete" ? "ml-auto" : undefined}
                    >
                      <input type="hidden" name="id" value={contact.id} />
                      <input type="hidden" name="operation" value={operation} />
                      <input type="hidden" name="value" value={String(value)} />
                      <SubmitButton
                        variant={operation === "delete" ? "danger" : "secondary"}
                        size="small"
                        pendingLabel={operation === "delete" ? "Removing…" : "Updating…"}
                        confirmMessage={
                          operation === "delete"
                            ? `Remove ${contact.display_name}? This also deletes their stored conversation history.`
                            : undefined
                        }
                      >
                        {label}
                      </SubmitButton>
                    </ActionForm>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
  });
}
