"use client";

import Link from "next/link";
import { KeyRound, Mail, Settings2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { SiGithub, SiGitlab } from "react-icons/si";
import { updateContactAccess } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { RepoPicker } from "@/components/integrations/repo-picker";
import {
  PROVIDER_ICONS,
  TaskSelect,
  type SelectTask,
} from "@/components/settings/task-select";
import type { ResourceOptions } from "@/lib/contacts/access-options";
import { cn } from "@/lib/utils";
import {
  CODES_TASK,
  PROVIDER_NAMES,
  TASKS,
  type ContactResources,
  type Task,
  type TaskProvider,
} from "../../../packages/agent-core/src/services/shortcuts";

const ALL_TASKS = [...TASKS, CODES_TASK];

/** Per-contact opt-in shown as its own group in the access dropdown. */
const SECRETS_TASK: SelectTask = {
  id: "secrets:view",
  provider: "secrets",
  capability: "view",
  label: "View secrets & full files",
};

type Options = ResourceOptions;
type Mailbox = { id: string; label: string; address: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Card summary: what the contact can use, and which repos/mailboxes. */
function Summary({
  access,
  resources,
  mailboxes,
  canViewSecrets,
}: {
  access: string[] | null;
  resources: ContactResources;
  mailboxes: Mailbox[];
  canViewSecrets: boolean;
}) {
  const has = (p: TaskProvider) =>
    access === null || access.some((t) => t.startsWith(`${p}:`));
  const rows: { provider: TaskProvider; text: string }[] = [];
  const repoText = (list: string[] | undefined, one: string, many: string) =>
    list === undefined
      ? `All ${many}`
      : list.length
        ? plural(list.length, one, many)
        : "None";
  if (has("github"))
    rows.push({
      provider: "github",
      text: repoText(resources.github, "repository", "repositories"),
    });
  if (has("gitlab"))
    rows.push({
      provider: "gitlab",
      text: repoText(resources.gitlab, "project", "projects"),
    });
  if (has("email"))
    rows.push({
      provider: "email",
      text:
        resources.mailboxes === undefined
          ? "All mailboxes"
          : resources.mailboxes.length
            ? mailboxes
                .filter((m) => resources.mailboxes!.includes(m.id))
                .map((m) => m.label)
                .join(", ") || plural(resources.mailboxes.length, "mailbox", "mailboxes")
            : "None",
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {access === null ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <ShieldCheck size={13} aria-hidden="true" className="text-accent" /> All
            integrations
          </span>
        ) : !access.length ? (
          <span className="text-xs text-muted">Chat only, no integrations</span>
        ) : (
          <span className="text-xs font-medium text-ink">
            {[
              ...new Set(
                ALL_TASKS.filter((t) => access.includes(t.id)).map((t) => t.provider),
              ),
            ]
              .map((p) => PROVIDER_NAMES[p])
              .join(", ")}
          </span>
        )}
        {canViewSecrets && (
          <span className="inline-flex items-center gap-1 rounded-md border border-danger/20 bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
            <KeyRound size={12} aria-hidden="true" /> Can view secrets
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <li
              key={r.provider}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] text-ink"
            >
              {PROVIDER_ICONS[r.provider]}
              <span className="truncate">{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "All" / "Selected" segmented control backed by a radio group. */
function Mode({
  name,
  value,
  onChange,
  allLabel,
}: {
  name: string;
  value: "all" | "selected";
  onChange: (v: "all" | "selected") => void;
  allLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-lg border border-border bg-canvas p-0.5"
    >
      {(["all", "selected"] as const).map((v) => (
        <label
          key={v}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent motion-reduce:transition-none",
            value === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="sr-only"
          />
          {v === "all" ? allLabel : "Selected"}
        </label>
      ))}
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border px-5 py-5 first:border-t-0 sm:px-6">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon} {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs leading-5 text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function RepoSection({
  provider,
  list,
  selected,
}: {
  provider: "github" | "gitlab";
  list: Options["github"];
  selected: string[] | undefined;
}) {
  const [mode, setMode] = useState<"all" | "selected">(selected ? "selected" : "all");
  const unit = provider === "github" ? "repositories" : "projects";
  if (!list) return null;
  return (
    <Section
      icon={
        provider === "github" ? (
          <SiGithub size={15} aria-hidden="true" />
        ) : (
          <SiGitlab size={15} color="#FC6D26" aria-hidden="true" />
        )
      }
      title={`${PROVIDER_NAMES[provider]} ${unit}`}
      hint={`Only ${unit} the ${PROVIDER_NAMES[provider]} integration allows are listed.`}
    >
      <Mode
        name={`${provider}_mode`}
        value={mode}
        onChange={setMode}
        allLabel={`All ${unit}`}
      />
      {mode === "selected" && (
        <RepoPicker
          name={`${provider}_repos`}
          options={list.options}
          defaultSelected={selected ?? []}
          placeholder={provider === "github" ? "owner/repository" : "group/project"}
          unit={unit}
          loadError={list.error}
        />
      )}
    </Section>
  );
}

/** Card box: access summary and a link to the Manage access page. */
export function AccessSummary({
  contactId,
  name,
  access,
  canViewSecrets = false,
  resources = {},
  mailboxes = [],
  showManage = true,
}: {
  contactId: string;
  name: string;
  access: string[] | null;
  canViewSecrets?: boolean;
  resources?: ContactResources;
  mailboxes?: Mailbox[];
  /** Hidden on the Manage access page itself. */
  showManage?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Access
          </p>
          <Summary
            access={access}
            resources={resources}
            mailboxes={mailboxes}
            canViewSecrets={canViewSecrets}
          />
        </div>
        {showManage && (
          <Link
            href={`/contacts/${contactId}`}
            aria-label={`Manage access for ${name}`}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Settings2 size={13} aria-hidden="true" /> Manage
          </Link>
        )}
      </div>
    </div>
  );
}

/** Full access form for the Manage access page. */
export function AccessEditor({
  contactId,
  access,
  available,
  canViewSecrets = false,
  resources = {},
  options,
}: {
  contactId: string;
  /** null = all integrations */
  access: string[] | null;
  /** Tasks that exist right now (connected integrations, enabled features). */
  available: Task[];
  canViewSecrets?: boolean;
  resources?: ContactResources;
  options: Options;
}) {
  const [all, setAll] = useState(access === null);
  const everything = available.map((t) => t.id);
  const [tasks, setTasks] = useState<string[]>(access ?? everything);
  const [secrets, setSecrets] = useState(canViewSecrets);
  const [mailboxMode, setMailboxMode] = useState<"all" | "selected">(
    resources.mailboxes ? "selected" : "all",
  );
  // With "All integrations" on, every integration task is shown ticked (and
  // locked); the separate Secrets checkbox stays editable and off by default.
  const shown = [...(all ? everything : tasks), ...(secrets ? [SECRETS_TASK.id] : [])];
  const uses = (p: TaskProvider) => all || tasks.some((t) => t.startsWith(`${p}:`));

  return (
    <ActionForm
      action={updateContactAccess}
      successMessage="Access saved."
      className="flex flex-col overflow-visible rounded-2xl border border-border bg-surface shadow-xs"
    >
      <input type="hidden" name="id" value={contactId} />
      <input type="hidden" name="tasks" value={JSON.stringify(tasks)} />
      {all && <input type="hidden" name="all" value="on" />}
      {secrets && <input type="hidden" name="can_view_secrets" value="on" />}

      <Section
        icon={<ShieldCheck size={15} aria-hidden="true" className="text-accent" />}
        title="What they can use"
        hint="Requests outside this get a “no access” reply on WhatsApp. Secrets stay off unless you tick them."
      >
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-canvas px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">All integrations</span>
            <span className="block text-xs text-muted">
              Includes anything you connect later.
            </span>
          </span>
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => {
              setAll(e.target.checked);
              if (!e.target.checked) setTasks(everything);
            }}
            role="switch"
            aria-label="All integrations"
            className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-border transition before:block before:size-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow-sm before:transition checked:border-accent checked:bg-accent checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:before:transition-none"
          />
        </label>
        <TaskSelect
          value={shown}
          onChange={(next) => {
            setSecrets(next.includes(SECRETS_TASK.id));
            if (!all) setTasks(next.filter((id) => id !== SECRETS_TASK.id));
          }}
          available={[...available, SECRETS_TASK]}
          locked={all ? everything : []}
          allowEmpty
          emptyLabel="No integrations (chat only)"
        />
      </Section>

      {uses("github") && (
        <RepoSection
          provider="github"
          list={options.github}
          selected={resources.github}
        />
      )}
      {uses("gitlab") && (
        <RepoSection
          provider="gitlab"
          list={options.gitlab}
          selected={resources.gitlab}
        />
      )}
      {uses("email") && options.mailboxes.length > 0 && (
        <Section
          icon={<Mail size={15} aria-hidden="true" className="text-accent" />}
          title="Mailboxes"
          hint="Which connected inboxes this contact can search and read."
        >
          <Mode
            name="mailbox_mode"
            value={mailboxMode}
            onChange={setMailboxMode}
            allLabel="All mailboxes"
          />
          {mailboxMode === "selected" && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {options.mailboxes.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-canvas px-3 py-2.5 has-[:checked]:border-accent/40">
                    <input
                      type="checkbox"
                      name="mailbox_ids"
                      value={m.id}
                      defaultChecked={resources.mailboxes?.includes(m.id) ?? false}
                      className="size-4 shrink-0 cursor-pointer accent-accent"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block truncate text-xs text-muted">
                        {m.address}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <footer className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-surface/95 px-5 py-4 backdrop-blur sm:px-6">
        <Link
          href="/contacts"
          className="rounded-lg text-sm font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">Save access</SubmitButton>
      </footer>
    </ActionForm>
  );
}
