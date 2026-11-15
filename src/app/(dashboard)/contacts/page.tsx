import { requireAdmin } from "@/lib/auth";
import { addContact, updateContact } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageTitle, Panel, Empty, Badge, date, assertData } from "@/components/ui";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

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
  return (
    <>
      <PageTitle
        eyebrow="EXPLICIT ACCESS"
        title="Your trusted circle."
        description="Choose who can activate your assistant. Every request must start with your activation prefix."
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
                  <article key={contact.id} className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-3">
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
                        <p className="mt-1 text-xs text-muted">{contact.phone}</p>
                      </div>
                      <Badge good={contact.active && contact.ai_access}>
                        {!contact.active
                          ? "Inactive"
                          : contact.ai_access
                            ? "AI allowed"
                            : "AI disabled"}
                      </Badge>
                    </div>
                    <div className="my-5 space-y-1.5 text-xs leading-6 text-muted">
                      <p>Last activity: {date(contact.last_activity)}</p>
                      <p>
                        {usage.data?.find((item) => item.contact_id === contact.id)
                          ?.messages?.[0]?.count ?? 0}{" "}
                        stored AI messages ·{" "}
                        {contact.preferred_language ?? "Match language"}
                      </p>
                      <p>Activation: prefix required</p>
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
                  </article>
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
