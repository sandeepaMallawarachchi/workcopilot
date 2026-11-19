"use client";

import { Check, ChevronDown, KeyRound, Lock, Mail, Mic } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SiGithub, SiGitlab } from "react-icons/si";
import { cn } from "@/lib/utils";
import {
  PROVIDER_NAMES,
  type Task,
  type TaskProvider,
} from "../../../packages/agent-core/src/services/shortcuts";

/** Brand marks for task groups. */
export const PROVIDER_ICONS: Record<TaskProvider, React.ReactNode> = {
  github: <SiGithub size={14} aria-hidden="true" />,
  gitlab: <SiGitlab size={14} color="#FC6D26" aria-hidden="true" />,
  email: <Mail size={14} aria-hidden="true" className="text-accent" />,
};

/** Groups beyond integrations (e.g. the per-contact "Secrets" permission). */
const GROUP_ICONS: Record<string, React.ReactNode> = {
  ...PROVIDER_ICONS,
  secrets: <KeyRound size={14} aria-hidden="true" className="text-danger" />,
  voice: <Mic size={14} aria-hidden="true" className="text-accent" />,
};
const GROUP_NAMES: Record<string, string> = {
  ...PROVIDER_NAMES,
  voice: "Voice",
  secrets: "Secrets",
};

/** A selectable task; `provider` is the group it is listed under. */
export type SelectTask = Omit<Task, "provider"> & {
  provider: TaskProvider | "voice" | "secrets";
};

/** Multi-select of agent tasks, grouped by provider. Lists only `available` tasks. */
export function TaskSelect({
  value,
  onChange,
  available,
  disabled = false,
  allowEmpty = false,
  emptyLabel = "Choose tasks…",
  locked = [],
}: {
  value: string[];
  onChange: (tasks: string[]) => void;
  available: SelectTask[];
  disabled?: boolean;
  /** Shown ticked but not changeable (e.g. covered by "All integrations"). */
  locked?: string[];
  /** An empty selection is valid (e.g. a contact with no integration access). */
  allowEmpty?: boolean;
  emptyLabel?: string;
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
    const map = new Map<string, SelectTask[]>();
    for (const t of available) map.set(t.provider, [...(map.get(t.provider) ?? []), t]);
    return [...map];
  }, [available]);
  const unavailable = value.filter((id) => !available.some((t) => t.id === id));
  const toggle = (id: string) => {
    if (locked.includes(id)) return;
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const summary = groups
    .map(([provider, tasks]) => {
      const picked = tasks.filter((t) => value.includes(t.id));
      if (!picked.length) return null;
      return {
        provider,
        text:
          picked.length === tasks.length && tasks.length > 1
            ? `All ${GROUP_NAMES[provider]}`
            : picked.map((t) => t.label).join(", "),
      };
    })
    .filter(Boolean) as { provider: string; text: string }[];

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-xl border bg-canvas px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          value.length || allowEmpty ? "border-border" : "border-danger/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5 py-1.5">
          {summary.length ? (
            summary.map((s) => (
              <span
                key={s.provider}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-ink"
              >
                {GROUP_ICONS[s.provider]}
                <span className="truncate">{s.text}</span>
              </span>
            ))
          ) : (
            <span className="text-muted">{emptyLabel}</span>
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
          className="absolute z-30 mt-1.5 max-h-72 w-full min-w-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1.5 shadow-lg"
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
                    {GROUP_ICONS[provider]} {GROUP_NAMES[provider]}
                  </span>
                  {tasks.length > 1 && !tasks.every((t) => locked.includes(t.id)) && (
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
                  const on = value.includes(t.id) || locked.includes(t.id);
                  const isLocked = locked.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      aria-disabled={isLocked}
                      title={isLocked ? "Included by All integrations" : undefined}
                      onClick={() => toggle(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink focus-visible:bg-accent-soft focus-visible:outline-none",
                        isLocked ? "cursor-default opacity-60" : "hover:bg-accent-soft",
                      )}
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
                      {isLocked && (
                        <Lock
                          size={12}
                          aria-hidden="true"
                          className="ml-auto text-muted"
                        />
                      )}
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
