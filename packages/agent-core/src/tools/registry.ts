import { z } from "zod";
import type { ToolDefinition } from "../providers/types.ts";
import { GitHub } from "./github.ts";
import { GitLab } from "./gitlab.ts";
import { EMAIL_TOOLS, type EmailTools } from "./email.ts";
import { redact } from "../security/sanitization.ts";
import { capabilityOf } from "../security/access.ts";
const names = [
  "list_github_repositories",
  "search_github_code",
  "get_github_file",
  "get_github_tree",
  "list_github_commits",
  "get_github_commit",
  "list_github_issues",
  "get_github_issue",
  "list_github_pull_requests",
  "get_github_pull_request",
  "list_gitlab_projects",
  "search_gitlab_repository",
  "get_gitlab_file",
  "get_gitlab_tree",
  "list_gitlab_commits",
  "get_gitlab_commit",
  "list_gitlab_issues",
  "get_gitlab_issue",
  "list_gitlab_merge_requests",
  "get_gitlab_merge_request",
  "get_gitlab_pipeline_status",
] as const;
const schema = z
  .object({
    repository: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/)
      .optional(),
    project: z
      .string()
      .regex(/^[\w./-]+$/)
      .optional(),
    path: z
      .string()
      .min(1)
      .max(300)
      .refine((x) => !x.split("/").includes("..") && !x.startsWith("/"))
      .optional(),
    ref: z.string().max(200).optional(),
    query: z.string().min(1).max(100).optional(),
    number: z.number().int().positive().optional(),
    sha: z
      .string()
      .regex(/^[\w.-]{1,100}$/)
      .optional(),
    page: z.number().int().min(1).max(5).default(1),
  })
  .strict();
export class Registry {
  constructor(
    private github?: GitHub,
    private gitlab?: GitLab,
    private secrets: string[] = [],
    /** Allowed capabilities per provider; omitted = everything allowed. */
    private capabilities: { github?: string[]; gitlab?: string[] } = {},
    /** Read-only email tools over connected mailboxes, when any exist. */
    private email?: EmailTools,
  ) {}
  private isEmailTool(name: string) {
    return (EMAIL_TOOLS as readonly string[]).includes(name);
  }
  private permitted(name: string) {
    const provider = name.includes("_github_") ? "github" : "gitlab";
    if (!(provider === "github" ? this.github : this.gitlab)) return false;
    const needed = capabilityOf(name);
    const allowed = this.capabilities[provider];
    return !needed || !allowed || allowed.includes(needed);
  }
  definitions(): ToolDefinition[] {
    // Compact per-tool schemas: only the parameters each tool uses. Every call
    // resends these, so size directly affects Groq tokens-per-minute limits.
    // Full validation still happens in execute() with the strict zod schema.
    const repoTools = names
      .filter((n) => this.permitted(n))
      .map((name) => {
        const target = name.includes("_github_") ? "repository" : "project";
        const props: Record<string, Record<string, string>> = {};
        const required: string[] = [];
        const add = (key: string, type: string, need = false) => {
          props[key] = { type };
          if (need) required.push(key);
        };
        if (!name.startsWith("list_") || !name.endsWith("_projects")) {
          if (name !== "list_github_repositories") add(target, "string", true);
        }
        if (name.endsWith("_file")) add("path", "string", true);
        if (name.endsWith("_tree")) add("path", "string");
        if (name.startsWith("search_")) add("query", "string", true);
        if (
          name.endsWith("_file") ||
          name.endsWith("_tree") ||
          name.endsWith("_commits") ||
          name.endsWith("_status")
        )
          add("ref", "string");
        if (name.endsWith("_commit")) add("sha", "string");
        if (/get_\w+_(issue|pull_request|merge_request)$/.test(name))
          add("number", "integer", true);
        if (name.startsWith("list_") || name.startsWith("search_"))
          add("page", "integer");
        return {
          type: "function" as const,
          function: {
            name,
            description: name.endsWith("_tree")
              ? "Read only: folder structure / file listing of a repository (optionally under path). Use this for structure questions instead of searching."
              : `Read only: ${name.replaceAll("_", " ")}.`,
            parameters: {
              type: "object",
              properties: props,
              required,
              additionalProperties: false,
            },
          },
        };
      });
    return [...repoTools, ...(this.email?.definitions() ?? [])];
  }
  /** Allowed repositories/projects, so the model can skip a listing call. */
  scope(): string {
    // One compact line per provider: this is resent on every model call.
    const gh = this.github?.allowed ?? [];
    const gl = this.gitlab?.allowed ?? [];
    return [
      gh.length ? `GitHub repositories: ${gh.slice(0, 150).join(", ")}` : "",
      gl.length ? `GitLab projects: ${gl.slice(0, 150).join(", ")}` : "",
      this.email?.mailboxes.length
        ? `Mailboxes (${this.email.sentAllowed ? "inbox and sent mail" : "inbox only"}): ${this.email.mailboxes.map((b) => `${b.label} (${b.address})`).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Owner opt-in ("View secrets & full files"): return tool output unmasked. */
  unmasked = false;
  private finish(result: unknown) {
    const raw = JSON.stringify(result);
    const output = this.unmasked ? raw : redact(raw, this.secrets);
    // Every tool result is resent on later model calls; keep it within Groq's
    // per-minute token budget.
    return output.length > 8000
      ? output.slice(0, 8000) +
          "\n[Tool result truncated at 8,000 characters; narrow the request or paginate.]"
      : output;
  }

  async execute(name: string, raw: string, signal?: AbortSignal) {
    if (this.isEmailTool(name)) {
      if (!this.email) throw new Error("No mailbox is connected");
      return this.finish(await this.email.execute(name, raw));
    }
    if (!names.includes(name as (typeof names)[number]))
      throw new Error("Tool denied by read-only registry");
    if (!this.permitted(name))
      throw new Error("This kind of access is turned off in the integration settings");
    // Models often send "" or "/" to mean "not specified"; normalize before the
    // strict schema so those calls succeed instead of failing validation.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "" || value === null) delete parsed[key];
    }
    if (typeof parsed.path === "string") {
      const path = parsed.path
        .trim()
        .replace(/^(\.\/|\/)+/, "")
        .replace(/\/+$/, "");
      if (path === "" || path === ".") delete parsed.path;
      else parsed.path = path;
    }
    const a = schema.parse(parsed);
    if (
      name.startsWith("get_") &&
      !name.endsWith("_file") &&
      !name.endsWith("_tree") &&
      !name.endsWith("_status") &&
      !name.endsWith("_commit") &&
      !a.number
    )
      throw new Error("Issue or request number required");
    if (name.includes("search_") && !a.query) throw new Error("Search query required");
    const provider = name.includes("_github_") ? this.github : this.gitlab;
    if (!provider) throw new Error("Integration is not connected");
    return this.finish(await provider.run(name, a, signal));
  }
}
