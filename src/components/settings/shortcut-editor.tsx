"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PROVIDER_ICONS as ICONS, TaskSelect } from "@/components/settings/task-select";
import {
  MAX_SHORTCUTS,
  TASKS,
  welcomeText,
  type Shortcut,
  type Task,
  type TaskProvider,
} from "../../../packages/agent-core/src/services/shortcuts";

const SUGGESTED: Record<TaskProvider, string> = {
  github: "@github",
  gitlab: "@gitlab",
  email: "@email",
};

type Row = Shortcut & { key: string };
let keySeq = 0;
const nextKey = () => `row-${++keySeq}`;

/** Renders WhatsApp *bold* / _italic_ for the preview. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block min-h-[1.25em]">
          {line
            .split(/(\*[^*]+\*|_[^_]+_)/g)
            .map((part, j) =>
              /^\*[^*]+\*$/.test(part) ? (
                <strong key={j}>{part.slice(1, -1)}</strong>
              ) : /^_[^_]+_$/.test(part) ? (
                <em key={j}>{part.slice(1, -1)}</em>
              ) : (
                part
              ),
            )}
        </span>
      ))}
    </>
  );
}

export function ShortcutEditor({
  mainPrefix,
  initial,
  available,
  followupMinutes,
}: {
  mainPrefix: string;
  initial: Shortcut[];
  available: Task[];
  followupMinutes: number;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((s) => ({ ...s, key: nextKey() })),
  );
  const update = (key: string, patch: Partial<Shortcut>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const providers = [...new Set(available.map((t) => t.provider))];
  const used = new Set(
    [mainPrefix, ...rows.map((r) => r.prefix)].map((p) => p.toLowerCase()),
  );
  const suggestions = providers.filter((p) => !used.has(SUGGESTED[p]));
  const duplicates = new Set(
    rows
      .map((r) => r.prefix.toLowerCase())
      .filter(
        (p, i, all) => p && (all.indexOf(p) !== i || p === mainPrefix.toLowerCase()),
      ),
  );
  const full = rows.length >= MAX_SHORTCUTS;

  const add = (provider?: TaskProvider) =>
    setRows((r) => [
      ...r,
      {
        key: nextKey(),
        prefix: provider ? SUGGESTED[provider] : "@",
        tasks: provider
          ? available.filter((t) => t.provider === provider).map((t) => t.id)
          : [],
      },
    ]);

  const preview = welcomeText({
    name: null,
    mainPrefix,
    shortcuts: rows.filter((r) => /^@[a-zA-Z]{1,12}$/.test(r.prefix) && r.tasks.length),
    followupMinutes,
    first: true,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-3">
        <input
          type="hidden"
          name="shortcuts"
          value={JSON.stringify(rows.map(({ prefix, tasks }) => ({ prefix, tasks })))}
        />

        <div className="flex items-center gap-3 rounded-xl border border-border bg-canvas/60 px-3 py-2.5">
          <span className="inline-flex min-w-24 items-center gap-1.5 font-mono text-sm font-semibold text-ink">
            <Lock size={13} aria-hidden="true" className="text-muted" />
            {mainPrefix}
          </span>
          <span className="text-sm text-muted">All connected tools</span>
          <span className="ml-auto text-[11px] text-muted">Change in Agent controls</span>
        </div>

        {rows.map((row) => {
          const dup = duplicates.has(row.prefix.toLowerCase());
          const invalid = row.prefix !== "@" && !/^@[a-zA-Z]{1,12}$/.test(row.prefix);
          return (
            <div key={row.key} className="space-y-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <label className="sr-only" htmlFor={row.key}>
                  Shortcut prefix
                </label>
                <div
                  className={cn(
                    "flex min-h-11 items-center rounded-xl border bg-canvas px-3 font-mono text-sm sm:w-36",
                    dup || invalid ? "border-danger/50" : "border-border",
                    "focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15",
                  )}
                >
                  <span className="text-muted">@</span>
                  <input
                    id={row.key}
                    value={row.prefix.replace(/^@/, "")}
                    onChange={(e) =>
                      update(row.key, {
                        prefix:
                          "@" + e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 12),
                      })
                    }
                    placeholder="name"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
                  />
                </div>
                <TaskSelect
                  value={row.tasks}
                  available={available}
                  onChange={(tasks) => update(row.key, { tasks })}
                />
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                  aria-label={`Remove ${row.prefix}`}
                  className="grid size-11 shrink-0 place-items-center self-end rounded-xl border border-border text-muted hover:border-danger/40 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent sm:self-auto"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              {(dup || invalid) && (
                <p className="text-xs text-danger">
                  {dup ? `${row.prefix} is already used.` : "Use 1–12 letters after @."}
                </p>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {suggestions.map((p) => (
            <button
              key={p}
              type="button"
              disabled={full}
              onClick={() => add(p)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs font-semibold text-ink hover:border-accent/50 hover:text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Plus size={13} aria-hidden="true" /> {ICONS[p]} {SUGGESTED[p]}
            </button>
          ))}
          <button
            type="button"
            disabled={full}
            onClick={() => add()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs font-semibold text-muted hover:border-accent/50 hover:text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus size={13} aria-hidden="true" /> Custom shortcut
          </button>
          <span className="ml-auto text-[11px] text-muted">
            {rows.length}/{MAX_SHORTCUTS}
          </span>
        </div>
        {TASKS.length > available.length && (
          <p className="text-xs leading-5 text-muted">
            Only tasks the agent can do right now are listed. Connect more in
            Integrations.
          </p>
        )}
      </div>

      <figure className="min-w-0">
        <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <WhatsAppIcon size={13} /> Welcome message preview
        </figcaption>
        <div className="rounded-2xl bg-[#0b141a] p-3">
          <div className="max-w-[95%] rounded-xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[13px] leading-5 text-[#e9edef] shadow">
            <WhatsAppText text={preview} />
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted">
          Sent once to each new contact before their first reply, and on “{mainPrefix}{" "}
          help”.
        </p>
      </figure>
    </div>
  );
}
