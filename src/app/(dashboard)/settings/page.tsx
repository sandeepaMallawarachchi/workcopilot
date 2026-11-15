import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageTitle, Panel, Badge, assertData } from "@/components/ui";
import { Field, Input, Select, Switch } from "@/components/ui/form";

export default async function Settings() {
  const { db, workspace } = await requireAdmin();
  const { data: settings, error } = await db
    .from("agent_settings")
    .select("*")
    .eq("workspace_id", workspace)
    .single();
  assertData(error);
  const numberSettings = [
    {
      name: "max_tool_calls",
      label: "Maximum tool calls",
      min: 1,
      max: 10,
      value: settings.max_tool_calls,
    },
    {
      name: "response_length",
      label: "Maximum reply characters",
      min: 200,
      max: 6000,
      value: settings.response_length,
    },
  ];
  const memorySettings = [
    {
      name: "context_messages",
      label: "Recent context messages",
      min: 0,
      max: 20,
      value: settings.context_messages,
      hint: "Only explicitly activated messages are used.",
    },
    {
      name: "context_hours",
      label: "Context expiration (hours)",
      min: 1,
      max: 168,
      value: settings.context_hours,
      hint: "Older messages are excluded from the agent’s context.",
    },
    {
      name: "retention_days",
      label: "History retention (days)",
      min: 1,
      max: 365,
      value: settings.retention_days,
      hint: "Expired history is removed by the daily retention schedule.",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="YOU SET THE BOUNDARIES"
        title="Make it work your way."
        description="Control activation, language, and memory. Keep your assistant working on your terms."
      />
      <ActionForm
        action={saveSettings}
        successMessage="Your agent settings have been saved."
      >
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Panel title="Agent controls">
            <div className="flex flex-col gap-6 p-5 sm:p-6">
              <Switch
                name="ai_enabled"
                label="Enable AI responses"
                description="Pause processing and replies for all contacts at once."
                defaultChecked={settings.ai_enabled}
              />
              <Field
                label="Activation prefix"
                hint="Case-insensitive, at the start of a message. Prefix activation is always required."
              >
                <Input
                  name="activation_prefix"
                  required
                  defaultValue={settings.activation_prefix}
                  pattern="@[a-zA-Z]{1,12}"
                  maxLength={13}
                />
              </Field>
              <Field label="Language behavior">
                <Select
                  name="language_behavior"
                  defaultValue={settings.language_behavior}
                >
                  <option value="match">Match the sender’s language</option>
                  {["English", "Sinhala", "Singlish"].map((language) => (
                    <option key={language}>{language}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Groq model"
                hint="Use a supported tool-calling model. Leave blank to use your server’s GROQ_MODEL setting."
              >
                <Input
                  name="groq_model"
                  defaultValue={settings.groq_model}
                  placeholder="Use server default"
                  maxLength={100}
                />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                {numberSettings.map(({ name, label, min, max, value }) => (
                  <Field
                    key={name}
                    label={label}
                    hint={`Allowed range: ${min.toLocaleString()}–${max.toLocaleString()}.`}
                  >
                    <Input
                      name={name}
                      type="number"
                      min={min}
                      max={max}
                      defaultValue={value}
                      required
                    />
                  </Field>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Context & privacy">
            <div className="flex flex-col gap-6 p-5 sm:p-6">
              {memorySettings.map(({ name, label, min, max, value, hint }) => (
                <Field key={name} label={label} hint={hint}>
                  <Input
                    name={name}
                    type="number"
                    min={min}
                    max={max}
                    defaultValue={value}
                    required
                  />
                </Field>
              ))}
              <div className="rounded-xl border border-accent/10 bg-accent-soft/50 p-5">
                <Badge good>Read-only mode enforced</Badge>
                <p className="mt-4 text-xs leading-7 text-muted">
                  The agent reads only authorized repositories. Access is controlled by
                  your contact and repository selections.
                </p>
                <p className="mt-3 text-xs leading-7 text-muted">
                  Conversation memory stays isolated per contact. You can delete and reset
                  it from Conversations.
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
          <p className="max-w-lg text-xs leading-6 text-muted">
            Changes apply to new processing and delivery checks.
          </p>
          <SubmitButton pendingLabel="Saving settings…" className="w-full sm:w-auto">
            Save settings
          </SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
