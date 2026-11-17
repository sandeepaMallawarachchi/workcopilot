/**
 * Per-integration access policy: which kinds of data the agent may read
 * (capabilities) and which paths it must never read (blocked paths).
 * Enforced server-side in the tool layer; the model never sees blocked content.
 */

export const CAPABILITIES = [
  {
    id: "code",
    label: "Code & files",
    description: "Read files, browse folder structure and search code.",
  },
  {
    id: "commits",
    label: "Commits",
    description: "List commits and read commit details (message, author, date).",
  },
  {
    id: "issues",
    label: "Issues",
    description: "List and read issues.",
  },
  {
    id: "pull_requests",
    label: "Pull / merge requests",
    description: "List and read pull requests (GitHub) or merge requests (GitLab).",
  },
  {
    id: "pipelines",
    label: "Pipelines",
    description: "Read CI pipeline status (GitLab).",
  },
] as const;
export type Capability = (typeof CAPABILITIES)[number]["id"];
export const ALL_CAPABILITIES: Capability[] = CAPABILITIES.map((c) => c.id);

/** Which capability a tool needs; null = always allowed (repository listing). */
export function capabilityOf(tool: string): Capability | null {
  if (/_(file|tree)$|^search_/.test(tool)) return "code";
  if (/_commits?$/.test(tool)) return "commits";
  if (/_issues?$/.test(tool)) return "issues";
  if (/_(pull_requests?|merge_requests?)$/.test(tool)) return "pull_requests";
  if (/_pipeline_status$/.test(tool)) return "pipelines";
  return null;
}

/**
 * Recommended rules for secrets and keys. Nothing is blocked by default: the
 * owner controls contacts and access, and adds these with one click if wanted.
 */
export const RECOMMENDED_BLOCKED = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "id_rsa",
  "id_ed25519",
  ".npmrc",
  ".netrc",
  "credentials.*",
  "secrets.*",
  "service-account*",
];

/** Suggested extra rules shown in the UI. */
export const SUGGESTED_BLOCKED = [
  "*.env",
  "config/secrets/",
  "*.sqlite",
  "*.tfstate",
  "*.tfvars",
  "docker-compose.override.yml",
];

const VALID_PATTERN = /^[\w.*?\-@+/ ]{1,200}$/;

/** Parses user input (one pattern per line or comma-separated), validating each. */
export function parseBlockedPatterns(input: string): string[] {
  const patterns = input
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#"));
  for (const p of patterns)
    if (!VALID_PATTERN.test(p) || p.split("/").includes(".."))
      throw new Error(`Invalid path pattern: ${p.slice(0, 40)}`);
  return [...new Set(patterns)].slice(0, 50);
}

function globToRegExp(pattern: string): RegExp {
  let p = pattern.trim();
  const directory = p.endsWith("/");
  p = p.replace(/\/+$/, "");
  const anchored = p.includes("/");
  p = p.replace(/^\/+/, "");
  let source = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "*" && p[i + 1] === "*") {
      const slash = p[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (ch === "*") source += "[^/]*";
    else if (ch === "?") source += "[^/]";
    else source += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  // Patterns without a slash match a file or folder name anywhere (like
  // .gitignore). Matching a folder also blocks everything inside it.
  const prefix = anchored ? "^" : "(?:^|/)";
  const suffix = directory ? "(?:/|$)" : "(?:$|/)";
  return new RegExp(prefix + source + suffix, "i");
}

/** True when the path matches any of the user's blocked patterns. */
export function pathBlocked(path: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const clean = path.replace(/^\/+/, "");
  return patterns.some((pattern) => {
    try {
      return globToRegExp(pattern).test(clean);
    } catch {
      return true; // fail closed on an unparsable rule
    }
  });
}
