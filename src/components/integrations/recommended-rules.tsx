"use client";

import { Plus, ShieldAlert } from "lucide-react";

/**
 * Suggests rules for secret files. Nothing is blocked by default; clicking
 * "Add" appends any missing rules to the blocked-paths box (saved on Save).
 */
export function RecommendedRules({
  targetId,
  rules,
}: {
  targetId: string;
  rules: string[];
}) {
  const add = () => {
    const box = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!box) return;
    const current = box.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const missing = rules.filter((r) => !current.includes(r));
    box.value = [...current, ...missing].join("\n");
    box.focus();
  };
  return (
    <div className="mt-3 rounded-xl border border-border bg-canvas p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ShieldAlert size={13} aria-hidden="true" /> Recommended for secrets
        </p>
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Plus size={13} aria-hidden="true" /> Add to my rules
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted">
        Nothing is blocked unless you add it. Without these, the agent can read .env files
        and keys in allowed repositories and send their contents to the AI provider and
        WhatsApp.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {rules.map((rule) => (
          <li
            key={rule}
            className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted"
          >
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
