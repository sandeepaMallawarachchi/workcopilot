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
/** Contact-only permission: the opt-in verification-codes feature. */
export const CODES_TASK: Task = {
  id: "email:codes",
  provider: "email",
  capability: "codes",
  label: "Verification codes",
};
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
export type Scope = {
  all: boolean;
  /** undefined = no restriction; null = provider excluded; array = allowed capabilities */
  github: string[] | null | undefined;
  gitlab: string[] | null | undefined;
  email: boolean;
  /** Opt-in verification codes (contact permission). */
  codes: boolean;
};
export const FULL_SCOPE: Scope = {
  all: true,
  github: undefined,
  gitlab: undefined,
  email: true,
  codes: true,
};

/** Scope from a task list; null = everything. */
export function scopeFromTasks(tasks: string[] | null | undefined): Scope {
  if (!tasks) return FULL_SCOPE;
  const caps = (provider: TaskProvider) =>
    TASKS.filter((t) => t.provider === provider && tasks.includes(t.id)).map(
      (t) => t.capability,
    );
  const gh = caps("github"),
    gl = caps("gitlab");
  return {
    all: false,
    github: gh.length ? gh : null,
    gitlab: gl.length ? gl : null,
    email: tasks.includes("email:read"),
    codes: tasks.includes(CODES_TASK.id),
  };
}

/**
 * Access for one request. `shortcut` null/unknown = main prefix = everything
 * the integrations allow. Otherwise the shortcut's tasks.
 */
export function scopeFor(
  shortcut: string | null | undefined,
  shortcuts: Shortcut[],
): Scope {
  const match = shortcut
    ? shortcuts.find((s) => s.prefix.toLowerCase() === shortcut.toLowerCase())
    : undefined;
  // Shortcuts never restrict verification codes on their own; email access does.
  return match ? { ...scopeFromTasks(match.tasks), codes: true } : FULL_SCOPE;
}

/** Both must allow it: shortcut scope ∩ contact access. */
export function combineScopes(a: Scope, b: Scope): Scope {
  const merge = (x: string[] | null | undefined, y: string[] | null | undefined) => {
    if (x === undefined) return y;
    if (y === undefined) return x;
    if (x === null || y === null) return null;
    const both = x.filter((c) => y.includes(c));
    return both.length ? both : null;
  };
  return {
    all: a.all && b.all,
    github: merge(a.github, b.github),
    gitlab: merge(a.gitlab, b.gitlab),
    email: a.email && b.email,
    codes: a.codes && b.codes && a.email && b.email,
  };
}

/** Which services a message is about (keyword-based, conservative). */
export function requestedProviders(text: string) {
  const t = text.toLowerCase();
  return {
    email: /\b(e-?mails?|mails?|inbox|gmail|unread)\b|ඊමේල්/.test(t),
    github: /\bgithub\b/.test(t),
    gitlab: /\bgitlab\b/.test(t),
    repo: /\b(repos?|repositor(y|ies)|commits?|pull requests?|merge requests?|pipelines?|branch(es)?|readme)\b|රිපෝ/.test(
      t,
    ),
  };
}

/** Services the message asks for that the scope does not allow. */
export function deniedProviders(text: string, scope: Scope): TaskProvider[] {
  if (scope.all) return [];
  const asked = requestedProviders(text);
  const denied: TaskProvider[] = [];
  if (asked.email && !scope.email) denied.push("email");
  if (asked.github && scope.github === null) denied.push("github");
  if (asked.gitlab && scope.gitlab === null) denied.push("gitlab");
  if (
    asked.repo &&
    !asked.github &&
    !asked.gitlab &&
    scope.github === null &&
    scope.gitlab === null
  )
    denied.push("github", "gitlab");
  return denied;
}

/** Friendly WhatsApp reply when a contact lacks access. */
export function noAccessText(providers: TaskProvider[], prefix?: string) {
  const names = [...new Set(providers)].map((p) => PROVIDER_NAMES[p]);
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0];
  return `🔒 You don't have access to ${list}${prefix ? ` (${prefix})` : ""} through WorkCopilot. Ask the owner to grant it if you need it.`;
}

/** Validates a contact's access list (null = all integrations). */
export function parseContactAccess(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Access must be a list");
  const known = new Set([...TASKS.map((t) => t.id), CODES_TASK.id]);
  return [...new Set(value.map(String))].filter((t) => known.has(t));
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
  /** The contact's access (null = all). Only usable shortcuts are listed. */
  access?: string[] | null;
}) {
  const access = o.access ?? null;
  const shortcuts = access
    ? o.shortcuts.filter((s) => s.tasks.some((t) => access.includes(t)))
    : o.shortcuts;
  const lines = [
    o.first
      ? `👋 Hi${o.name ? ` ${o.name}` : ""}! I'm *WorkCopilot*, your read-only work assistant.`
      : "📋 *WorkCopilot shortcuts*",
    "",
    "Start a message with:",
    `• *${o.mainPrefix}* — anything, using ${access ? "the tools you have access to" : "all connected tools"}`,
    ...shortcuts.map((s) => `• *${s.prefix}* — ${describeTasks(s.tasks)}`),
  ];
  const example = shortcuts.find((s) => s.tasks.length);
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

/**
 * Per-contact resource limits. A missing key means "everything the integration
 * allows"; an empty list means "none".
 */
export type ContactResources = {
  github?: string[];
  gitlab?: string[];
  mailboxes?: string[];
};

const REPO_PATH = /^[\w.-]+(?:\/[\w.-]+)+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads stored resources defensively (bad entries are dropped). */
export function storedResources(value: unknown): ContactResources {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const list = (x: unknown, ok: RegExp) =>
    Array.isArray(x)
      ? [...new Set(x.map(String).filter((s) => ok.test(s)))].slice(0, 300)
      : undefined;
  const out: ContactResources = {};
  const gh = list(v.github, REPO_PATH),
    gl = list(v.gitlab, REPO_PATH),
    mb = list(v.mailboxes, UUID);
  if (gh) out.github = gh;
  if (gl) out.gitlab = gl;
  if (mb) out.mailboxes = mb;
  return out;
}

/** An empty selection removes that source from the contact's scope. */
export function limitScope(scope: Scope, res: ContactResources): Scope {
  return {
    ...scope,
    all: scope.all && !res.github && !res.gitlab && !res.mailboxes,
    github: res.github && !res.github.length ? null : scope.github,
    gitlab: res.gitlab && !res.gitlab.length ? null : scope.gitlab,
    email: res.mailboxes && !res.mailboxes.length ? false : scope.email,
    codes: res.mailboxes && !res.mailboxes.length ? false : scope.codes,
  };
}

/** Narrows an integration's list to the contact's selection (missing = all). */
export function narrow<T>(
  items: T[],
  selected: string[] | undefined,
  key: (item: T) => string,
) {
  if (!selected) return items;
  const set = new Set(selected.map((s) => s.toLowerCase()));
  return items.filter((item) => set.has(key(item).toLowerCase()));
}

/** How names are often spoken or transcribed in Sinhala script. */
const SINHALA_NAMES: Record<string, string[]> = {
  ai: ["ඒ අයි", "ඒආයි", "ඒ.අයි", "එයි අයි"],
  github: ["ගිට්හබ්", "ගිට් හබ්", "ගිතබ්"],
  gitlab: ["ගිට්ලැබ්", "ගිට් ලැබ්", "ගිට්ලබ්"],
  email: ["ඊමේල්", "ඊ මේල්", "ඊ-මේල්", "මේල්"],
  mail: ["මේල්"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds a prefix spoken at the start of a voice-note transcript, e.g.
 * "AI, what's new?", "Hey GitHub — latest commit", "at email any unread mail".
 * Returns the matched prefix (as configured, e.g. "@github") and the rest of
 * the request, or null when the note does not start with one.
 *
 * `vocative` is true when the name was clearly addressed (followed by a pause
 * such as a comma, or preceded by "hey"/"at"); only then is it removed from the
 * request text, so "GitHub's latest commit" keeps its meaning.
 */
export function parseSpokenPrefix(
  transcript: string,
  prefixes: string[],
): { prefix: string; rest: string; vocative: boolean } | null {
  const text = transcript.trim();
  const filler = "^(?:(?:hey|hi|hello|ok(?:ay)?|yo|dear|හායි|හේයි)[\\s,.!]+)?(@|at\\s+)?";
  const options = prefixes
    .map((prefix) => {
      const name = prefix.replace(/^@/, "").toLowerCase();
      const spelled = name.split("").map(escape).join("[\\s.'-]?");
      const alts = [spelled, ...(SINHALA_NAMES[name] ?? []).map(escape)];
      return { prefix, alts };
    })
    // Longer names first ("gitlab" before "git…").
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, alts } of options) {
    const re = new RegExp(
      `${filler}(?:${alts.join("|")})(?![\\p{L}\\p{N}])([\\s]*[,.:;!?—–-]+)?\\s*`,
      "iu",
    );
    const m = re.exec(text);
    if (!m) continue;
    const addressed =
      Boolean(m[1]) ||
      Boolean(m[2]) ||
      /^(hey|hi|hello|ok|yo|dear|හායි|හේයි)/i.test(text);
    const rest = text.slice(m[0].length).trim();
    return addressed
      ? { prefix, rest, vocative: true }
      : { prefix, rest: text, vocative: false };
  }
  return null;
}
