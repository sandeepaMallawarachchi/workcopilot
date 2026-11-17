"use client";

import { Check, ChevronDown, Lock, Mail, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SiGithub, SiGitlab } from "react-icons/si";
import { WhatsAppIcon } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  MAX_SHORTCUTS,
  PROVIDER_NAMES,
  TASKS,
  welcomeText,
  type Shortcut,
  type Task,
  type TaskProvider,
} from "../../../packages/agent-core/src/services/shortcuts";

const ICONS: Record<TaskProvider, React.ReactNode> = {
  github: <SiGithub size={14} aria-hidden="true" />,
  gitlab: <SiGitlab size={14} color="#FC6D26" aria-hidden="true" />,
  email: <Mail size={14} aria-hidden="true" className="text-accent" />,
};
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

function TaskSelect({
  value,
  onChange,
  available,
}: {
  value: string[];
  onChange: (tasks: string[]) => void;
  available: Task[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<TaskProvider, Task[]>();
    for (const t of available) map.set(t.provider, [...(map.get(t.provider) ?? []), t]);
    return [...map];
  }, [available]);
  const unavailable = value.filter((id) => !available.some((t) => t.id === id));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const summary = groups
    .map(([provider, tasks]) => {
      const picked = tasks.filter((t) => value.includes(t.id));
      if (!picked.length) return null;
      return {
        provider,
        text:
          picked.length === tasks.length
            ? `All ${PROVIDER_NAMES[provider]}`
            : picked.map((t) => t.label).join(", "),
      };
    })
    .filter(Boolean) as { provider: TaskProvider; text: string }[];

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-xl border bg-canvas px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          value.length ? "border-border" : "border-danger/40",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5 py-1.5">
          {summary.length ? (
            summary.map((s) => (
              <span
                key={s.provider}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-ink"
              >
                {ICONS[s.provider]}
                <span className="truncate">{s.text}</span>
              </span>
            ))
          ) : (
            <span className="text-muted">Choose tasks…</span>
          )}
          {unavailable.length > 0 && (
            <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs text-danger">
              {unavailable.length} unavailable
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1.5 w-full min-w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          {groups.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-muted">
              Connect GitHub, GitLab or a mailbox in Integrations to choose tasks.
            </p>
          )}
          {groups.map(([provider, tasks]) => {
            const all = tasks.every((t) => value.includes(t.id));
            return (
              <div key={provider} className="py-1 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink">
                    {ICONS[provider]} {PROVIDER_NAMES[provider]}
                  </span>
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          all
                            ? value.filter((v) => !tasks.some((t) => t.id === v))
                            : [...new Set([...value, ...tasks.map((t) => t.id)])],
                        )
                      }
                      className="rounded text-[11px] font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {all ? "Clear" : "Select all"}
                    </button>
                  )}
                </div>
                {tasks.map((t) => {
                  const on = value.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(t.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border",
                          on ? "border-accent bg-accent text-white" : "border-border",
                        )}
                      >
                        {on && <Check size={12} aria-hidden="true" />}
                      </span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
