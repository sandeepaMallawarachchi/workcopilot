import { requireAdmin } from "@/lib/auth";
import { saveSettings, saveShortcuts } from "@/app/actions";
import { ShortcutEditor } from "@/components/settings/shortcut-editor";
import {
  availableTasks,
  storedShortcuts,
} from "../../../../packages/agent-core/src/services/shortcuts";
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
  // What the agent can do right now, so the shortcut dropdown only offers real tasks.
  const [{ data: integrations }, { data: mailboxes }] = await Promise.all([
    db
      .from("integrations")
      .select("provider,status,capabilities")
      .eq("workspace_id", workspace),
    db.from("mailboxes").select("id").eq("workspace_id", workspace),
  ]);
  const caps = (provider: string) => {
    const row = integrations?.find(
      (i) => i.provider === provider && i.status === "connected",
    );
    return row
      ? (row.capabilities ?? ["code", "commits", "issues", "pull_requests", "pipelines"])
      : null;
  };
  const tasks = availableTasks({
    github: caps("github"),
    gitlab: caps("gitlab"),
    email: (mailboxes?.length ?? 0) > 0,
  });
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
      hint: "Only activated messages and their follow-ups are used.",
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
                label="Main prefix (all tools)"
                hint="Case-insensitive, at the start of a message. Uses every connected tool. Add focused shortcuts like @github below."
              >
                <Input
                  name="activation_prefix"
                  required
                  defaultValue={settings.activation_prefix}
                  pattern="@[a-zA-Z]{1,12}"
                  maxLength={13}
                />
              </Field>
              <Field
                label="Follow-up window (minutes)"
                hint="After a prefixed message, replies continue without the prefix until this many minutes pass with no messages. 0 always requires the prefix. Allowed range: 0–60."
              >
                <Input
                  name="followup_minutes"
                  type="number"
                  required
                  min={0}
                  max={60}
                  defaultValue={settings.followup_minutes ?? 10}
                />
              </Field>
              <Field
                label="Voice notes"
                hint="Voice notes are transcribed and answered like typed messages. Start one by saying a prefix, e.g. “AI, what’s new?” or “GitHub, latest commit…”. Notes without a prefix outside a conversation are discarded unread. The audio is never stored."
              >
                <Select
                  name="voice_mode"
                  defaultValue={settings.voice_mode ?? "followup"}
                >
                  <option value="followup">
                    When you say a prefix, or during a conversation
                  </option>
                  <option value="always">Always (any voice note, full access)</option>
                  <option value="off">Off</option>
                </Select>
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

      <Panel title="Shortcuts">
        <ActionForm
          action={saveShortcuts}
          successMessage="Shortcuts saved."
          className="p-5 sm:p-6"
        >
          <p className="mb-5 max-w-2xl text-xs leading-6 text-muted">
            Give a prefix its own job, like{" "}
            <span className="font-mono text-ink">@github</span> for repositories or{" "}
            <span className="font-mono text-ink">@email</span> for your inbox. The agent
            then only uses those tools, so answers are faster, cheaper and stay on topic.
          </p>
          <ShortcutEditor
            mainPrefix={settings.activation_prefix}
            initial={storedShortcuts(settings.shortcuts)}
            available={tasks}
            followupMinutes={settings.followup_minutes ?? 10}
          />
          <div className="mt-6 flex justify-end border-t border-border pt-5">
            <SubmitButton pendingLabel="Saving shortcuts…">Save shortcuts</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
