import { z } from "zod";
import type { ToolDefinition } from "../providers/types.ts";
import { GitHub } from "./github.ts";
import { GitLab } from "./gitlab.ts";
import { redact } from "../security/sanitization.ts";
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
  ) {}
  definitions(): ToolDefinition[] {
    // Compact per-tool schemas: only the parameters each tool uses. Every call
    // resends these, so size directly affects Groq tokens-per-minute limits.
    // Full validation still happens in execute() with the strict zod schema.
    return names
      .filter((n) => (n.includes("_github_") ? !!this.github : !!this.gitlab))
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
  }
  /** Allowed repositories/projects, so the model can skip a listing call. */
  scope(): string {
    // One compact line per provider: this is resent on every model call.
    const gh = this.github?.allowed ?? [];
    const gl = this.gitlab?.allowed ?? [];
    return [
      gh.length ? `GitHub repositories: ${gh.slice(0, 150).join(", ")}` : "",
      gl.length ? `GitLab projects: ${gl.slice(0, 150).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async execute(name: string, raw: string, signal?: AbortSignal) {
    if (!names.includes(name as (typeof names)[number]))
      throw new Error("Tool denied by read-only registry");
    const a = schema.parse(JSON.parse(raw));
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
    const result = await provider.run(name, a, signal);
    const output = redact(JSON.stringify(result), this.secrets);
    return output.length > 12000
      ? output.slice(0, 12000) +
          "\n[Tool result truncated at 12,000 characters; narrow the request or paginate.]"
      : output;
  }
}
