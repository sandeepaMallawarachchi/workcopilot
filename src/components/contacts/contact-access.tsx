"use client";

import { KeyRound, Pencil, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { updateContactAccess } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PROVIDER_ICONS, TaskSelect } from "@/components/settings/task-select";
import { cn } from "@/lib/utils";
import {
  CODES_TASK,
  PROVIDER_NAMES,
  TASKS,
  type Task,
  type TaskProvider,
} from "../../../packages/agent-core/src/services/shortcuts";

const ALL_TASKS = [...TASKS, CODES_TASK];

/** Grouped, human summary of a contact's access. */
function Summary({ access }: { access: string[] | null }) {
  if (access === null)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
        <ShieldCheck size={13} aria-hidden="true" className="text-accent" /> All
        integrations
      </span>
    );
  if (!access.length)
    return <span className="text-xs text-muted">Chat only, no integrations</span>;
  const groups = new Map<TaskProvider, string[]>();
  for (const t of ALL_TASKS.filter((t) => access.includes(t.id)))
    groups.set(t.provider, [...(groups.get(t.provider) ?? []), t.label]);
  return (
    <span className="flex flex-wrap gap-1.5">
      {[...groups].map(([provider, labels]) => (
        <span
          key={provider}
          title={labels.join(", ")}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] text-ink"
        >
          {PROVIDER_ICONS[provider]}
          <span className="truncate">
            {PROVIDER_NAMES[provider]}: {labels.join(", ")}
          </span>
        </span>
      ))}
    </span>
  );
}

export function ContactAccess({
  contactId,
  name,
  access,
  available,
  canViewSecrets = false,
}: {
  contactId: string;
  name: string;
  /** Owner opt-in: may see secrets and full files (e.g. .env). */
  canViewSecrets?: boolean;
  /** null = all integrations */
  access: string[] | null;
  /** Tasks that exist right now (connected integrations, enabled features). */
  available: Task[];
}) {
  const [editing, setEditing] = useState(false);
  const [secrets, setSecrets] = useState(canViewSecrets);
  const [all, setAll] = useState(access === null);
  const everything = available.map((t) => t.id);
  const [tasks, setTasks] = useState<string[]>(access ?? everything);
  // With "All integrations" on, the list always reflects everything available
  // right now, without needing a refresh.
  const shown = all ? everything : tasks;

  return (
    <div className="rounded-xl border border-border bg-canvas/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Access
          </p>
          <Summary access={access} />
          {canViewSecrets && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-danger/20 bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
              <KeyRound size={12} aria-hidden="true" /> Can view secrets
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
          aria-label={editing ? "Cancel editing access" : `Edit access for ${name}`}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          {editing ? (
            <>
              <X size={13} aria-hidden="true" /> Cancel
            </>
          ) : (
            <>
              <Pencil size={13} aria-hidden="true" /> Edit
            </>
          )}
        </button>
      </div>

      {editing && (
        <ActionForm
          action={updateContactAccess}
          successMessage="Access updated."
          className="mt-3 flex flex-col gap-3 border-t border-border pt-3"
        >
          <input type="hidden" name="id" value={contactId} />
          <input type="hidden" name="tasks" value={JSON.stringify(tasks)} />
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-ink">All integrations</span>
              <span className="block text-xs text-muted">
                Includes anything you connect later.
              </span>
            </span>
            <input
              type="checkbox"
              name="all"
              checked={all}
              onChange={(e) => {
                setAll(e.target.checked);
                // Turning "All" off starts from the full list, ready to narrow down.
                if (!e.target.checked) setTasks(everything);
              }}
              role="switch"
              className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-border transition before:block before:size-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow-sm before:transition checked:border-accent checked:bg-accent checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:before:transition-none"
            />
          </label>
          <div className={cn(all && "pointer-events-none opacity-40")} aria-hidden={all}>
            <TaskSelect
              value={shown}
              onChange={setTasks}
              available={available}
              disabled={all}
              allowEmpty
              emptyLabel="No integrations (chat only)"
            />
            <p className="mt-1.5 text-[11px] leading-5 text-muted">
              Requests outside this list get a “no access” reply on WhatsApp.
            </p>
          </div>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-danger/20 bg-danger-soft/60 p-3">
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <KeyRound size={14} aria-hidden="true" className="text-danger" /> May view
                secrets
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                Shows full files and values on request, like .env, keys and tokens,
                including WorkCopilot&apos;s own. They pass through the AI provider and
                WhatsApp.
              </span>
            </span>
            <input
              type="checkbox"
              name="can_view_secrets"
              checked={secrets}
              onChange={(e) => setSecrets(e.target.checked)}
              role="switch"
              aria-label={`Allow ${name} to view secrets`}
              className="mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-border transition before:block before:size-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow-sm before:transition checked:border-danger checked:bg-danger checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:before:transition-none"
            />
          </label>
          <SubmitButton size="small" pendingLabel="Saving…" className="self-start">
            Save access
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
