import { requireAdmin } from "@/lib/auth";
import { addContact, updateContact } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import {
  PageTitle,
  Panel,
  Empty,
  Badge,
  date,
  assertData,
  WhatsAppIcon,
} from "@/components/ui";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ChevronDown } from "lucide-react";
import { ContactAccess } from "@/components/contacts/contact-access";
import {
  CODES_TASK,
  PROVIDER_NAMES,
  TASKS,
  availableTasks,
} from "../../../../packages/agent-core/src/services/shortcuts";

/** One-line access summary for the collapsed contact row. */
function accessSummary(access: string[] | null) {
  if (access === null) return "All integrations";
  if (!access.length) return "Chat only";
  const providers = [
    ...new Set(
      [...TASKS, CODES_TASK].filter((t) => access.includes(t.id)).map((t) => t.provider),
    ),
  ];
  return providers.map((p) => PROVIDER_NAMES[p]).join(", ");
}

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
  // Tasks that exist right now, so access can only be granted to real things.
  const [{ data: integrations }, { data: mailboxes }, { data: settings }] =
    await Promise.all([
      db
        .from("integrations")
        .select("provider,status,capabilities")
        .eq("workspace_id", workspace),
      db.from("mailboxes").select("id").eq("workspace_id", workspace),
      db
        .from("agent_settings")
        .select("verification_codes_enabled")
        .eq("workspace_id", workspace)
        .single(),
    ]);
  const caps = (provider: string) => {
    const row = integrations?.find(
      (i) => i.provider === provider && i.status === "connected",
    );
    return row
      ? (row.capabilities ?? ["code", "commits", "issues", "pull_requests", "pipelines"])
      : null;
  };
  const hasMail = (mailboxes?.length ?? 0) > 0;
  const tasks = [
    ...availableTasks({ github: caps("github"), gitlab: caps("gitlab"), email: hasMail }),
    ...(hasMail && settings?.verification_codes_enabled ? [CODES_TASK] : []),
  ];
  return (
    <>
      <PageTitle
        eyebrow="EXPLICIT ACCESS"
        title="Your trusted circle."
        description="Choose who can use your assistant, and which integrations each person can reach."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel title={`Authorized contacts${data?.length ? ` · ${data.length}` : ""}`}>
          {!data?.length ? (
            <Empty
              title="No contacts yet"
              description="Add your Meta-verified test recipient using the form to get started."
            />
          ) : (
            <div className="divide-y divide-border">
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
                  <details key={contact.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-canvas/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-6 [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent"
                      >
                        {contact.display_name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-ink">
                          {contact.display_name}
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <WhatsAppIcon size={12} />
                            {contact.phone}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{accessSummary(contact.allowed_tasks ?? null)}</span>
                        </p>
                      </div>
                      <Badge good={contact.active && contact.ai_access}>
                        {!contact.active
                          ? "Inactive"
                          : contact.ai_access
                            ? "AI allowed"
                            : "AI disabled"}
                      </Badge>
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      />
                    </summary>
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                      <div className="mb-5 space-y-1.5 text-xs leading-6 text-muted">
                        <p>Last activity: {date(contact.last_activity)}</p>
                        <p>
                          {usage.data?.find((item) => item.contact_id === contact.id)
                            ?.messages?.[0]?.count ?? 0}{" "}
                          stored AI messages ·{" "}
                          {contact.preferred_language ?? "Match language"}
                        </p>
                      </div>
                      <div className="mb-5">
                        <ContactAccess
                          contactId={contact.id}
                          name={contact.display_name}
                          access={contact.allowed_tasks ?? null}
                          available={tasks}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {operations.map(({ operation, value, label }) => (
                          <ActionForm
                            action={updateContact}
                            key={operation}
                            successMessage="Contact updated."
                          >
                            <input type="hidden" name="id" value={contact.id} />
                            <input type="hidden" name="operation" value={operation} />
                            <input type="hidden" name="value" value={String(value)} />
                            <SubmitButton
                              variant={operation === "delete" ? "danger" : "secondary"}
                              size="small"
                              pendingLabel={
                                operation === "delete" ? "Removing…" : "Updating…"
                              }
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
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Add a contact">
          <ActionForm
            action={addContact}
            resetOnSuccess
            successMessage="Contact added. Verify the same recipient in Meta before sending replies."
            className="p-5 sm:p-6"
          >
            <div className="flex flex-col gap-6">
              <Field label="Display name">
                <Input
                  name="display_name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="e.g. My personal number"
                />
              </Field>
              <Field
                label="WhatsApp number"
                hint="Include the country code and verify this recipient in Meta API Setup."
              >
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="+94 77 123 4567"
                />
              </Field>
              <Field label="Preferred language">
                <Select name="preferred_language">
                  <option value="">Match their message</option>
                  {["English", "Sinhala", "Singlish"].map((language) => (
                    <option key={language}>{language}</option>
                  ))}
                </Select>
              </Field>
              <Checkbox name="ai_access" label="Grant AI access" />
              <SubmitButton pendingLabel="Adding contact…" className="self-start">
                Add contact
              </SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
