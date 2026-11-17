/**
 * Prefix shortcuts: "@github …" or "@email …" limit the agent to selected
 * tasks. Fewer tools per request means fewer tokens and better routing.
 * The main prefix (agent_settings.activation_prefix, e.g. "@ai") keeps full access.
 */

export type TaskProvider = "github" | "gitlab" | "email";
export type Task = {
  id: string;
  provider: TaskProvider;
  capability: string;
  label: string;
};

export const TASKS: Task[] = [
  { id: "github:code", provider: "github", capability: "code", label: "Code & files" },
  { id: "github:commits", provider: "github", capability: "commits", label: "Commits" },
  { id: "github:issues", provider: "github", capability: "issues", label: "Issues" },
  {
    id: "github:pull_requests",
    provider: "github",
    capability: "pull_requests",
    label: "Pull requests",
  },
  { id: "gitlab:code", provider: "gitlab", capability: "code", label: "Code & files" },
  { id: "gitlab:commits", provider: "gitlab", capability: "commits", label: "Commits" },
  { id: "gitlab:issues", provider: "gitlab", capability: "issues", label: "Issues" },
  {
    id: "gitlab:pull_requests",
    provider: "gitlab",
    capability: "pull_requests",
    label: "Merge requests",
  },
  {
    id: "gitlab:pipelines",
    provider: "gitlab",
    capability: "pipelines",
    label: "Pipelines",
  },
  {
    id: "email:read",
    provider: "email",
    capability: "read",
    label: "Search & read email",
  },
];
export const PROVIDER_NAMES: Record<TaskProvider, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  email: "Email",
};

export type Shortcut = { prefix: string; tasks: string[] };
const PREFIX = /^@[a-zA-Z]{1,12}$/;
export const MAX_SHORTCUTS = 10;

/** What is connected right now; null = provider not connected. */
export type Availability = {
  github: string[] | null; // enabled capabilities
  gitlab: string[] | null;
  email: boolean;
};

/** Tasks the agent can actually perform with current connections/settings. */
export function availableTasks(a: Availability): Task[] {
  return TASKS.filter((t) =>
    t.provider === "email"
      ? a.email
      : (a[t.provider] ?? null) !== null && a[t.provider]!.includes(t.capability),
  );
}

/** Validates stored or submitted shortcuts. Throws with a readable message. */
export function parseShortcuts(value: unknown, mainPrefix: string): Shortcut[] {
  if (!Array.isArray(value)) throw new Error("Shortcuts must be a list");
  const seen = new Set([mainPrefix.toLowerCase()]);
  const known = new Set(TASKS.map((t) => t.id));
  const out: Shortcut[] = [];
  for (const raw of value.slice(0, MAX_SHORTCUTS + 1)) {
    const prefix = String((raw as Shortcut)?.prefix ?? "").trim();
    const tasks = Array.isArray((raw as Shortcut)?.tasks) ? (raw as Shortcut).tasks : [];
    if (!PREFIX.test(prefix))
      throw new Error(
        `"${prefix.slice(0, 15) || "(empty)"}" must be @ followed by 1–12 letters`,
      );
    if (seen.has(prefix.toLowerCase()))
      throw new Error(`${prefix} is used more than once`);
    seen.add(prefix.toLowerCase());
    const clean = [...new Set(tasks.map(String))].filter((t) => known.has(t));
    if (!clean.length) throw new Error(`Choose at least one task for ${prefix}`);
    out.push({ prefix, tasks: clean });
  }
  if (out.length > MAX_SHORTCUTS) throw new Error(`Up to ${MAX_SHORTCUTS} shortcuts`);
  return out;
}

/** Reads shortcuts from the database without throwing (bad rows are dropped). */
export function storedShortcuts(value: unknown): Shortcut[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is Shortcut =>
      PREFIX.test(String(s?.prefix ?? "")) &&
      Array.isArray(s?.tasks) &&
      s.tasks.length > 0,
  );
}

/**
 * Access for one request. `shortcut` null/unknown = main prefix = everything
 * the integrations allow. Otherwise the intersection with the shortcut's tasks.
 */
export function scopeFor(shortcut: string | null | undefined, shortcuts: Shortcut[]) {
  const match = shortcut
    ? shortcuts.find((s) => s.prefix.toLowerCase() === shortcut.toLowerCase())
    : undefined;
  if (!match)
    return { all: true as const, github: undefined, gitlab: undefined, email: true };
  const caps = (provider: TaskProvider) =>
    TASKS.filter((t) => t.provider === provider && match.tasks.includes(t.id)).map(
      (t) => t.capability,
    );
  const gh = caps("github"),
    gl = caps("gitlab");
  return {
    all: false as const,
    /** null = provider excluded entirely; array = allowed capabilities */
    github: gh.length ? gh : null,
    gitlab: gl.length ? gl : null,
    email: match.tasks.includes("email:read"),
  };
}

/** Intersects integration capabilities with a shortcut's allowed ones. */
export function intersect(
  base: string[] | undefined,
  scoped: string[] | null | undefined,
) {
  if (scoped === undefined) return base;
  if (scoped === null) return [];
  return base ? base.filter((c) => scoped.includes(c)) : scoped;
}

/** Short human description of a shortcut's tasks, grouped by provider. */
export function describeTasks(tasks: string[]) {
  const groups = new Map<TaskProvider, string[]>();
  for (const t of TASKS.filter((t) => tasks.includes(t.id)))
    groups.set(t.provider, [...(groups.get(t.provider) ?? []), t.label.toLowerCase()]);
  return [...groups]
    .map(([p, labels]) =>
      p === "email" ? "your email" : `${PROVIDER_NAMES[p]} ${labels.join(", ")}`,
    )
    .join("; ");
}

/** Requests that should get the shortcut list instead of an AI answer. */
export function isHelpRequest(prompt: string) {
  return /^(help|menu|commands|shortcuts|start|\?|උදව්)[\s.!?]*$/i.test(prompt.trim());
}

const EXAMPLES: Record<TaskProvider, string> = {
  github: "latest commit in projectlens",
  gitlab: "pipeline status of avant-custom-builds",
  email: "any unread mail from the client?",
};

/** WhatsApp welcome / help message listing the available prefixes. */
export function welcomeText(o: {
  name?: string | null;
  mainPrefix: string;
  shortcuts: Shortcut[];
  followupMinutes: number;
  first: boolean;
}) {
  const lines = [
    o.first
      ? `👋 Hi${o.name ? ` ${o.name}` : ""}! I'm *WorkCopilot*, your read-only work assistant.`
      : "📋 *WorkCopilot shortcuts*",
    "",
    "Start a message with:",
    `• *${o.mainPrefix}* — anything, using all connected tools`,
    ...o.shortcuts.map((s) => `• *${s.prefix}* — ${describeTasks(s.tasks)}`),
  ];
  const example = o.shortcuts.find((s) => s.tasks.length);
  const provider = example
    ? TASKS.find((t) => t.id === example.tasks[0])?.provider
    : undefined;
  lines.push(
    "",
    `Example: _${example && provider ? `${example.prefix} ${EXAMPLES[provider]}` : `${o.mainPrefix} what's new in my repos?`}_`,
  );
  if (o.followupMinutes > 0)
    lines.push(`Follow-ups within ${o.followupMinutes} min don't need a prefix.`);
  lines.push(`Send *${o.mainPrefix} help* anytime to see this again.`);
  return lines.join("\n");
}
