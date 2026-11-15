import { z } from "zod";
import type { ToolDefinition } from "../providers/types.ts";
import { GitHub } from "./github.ts";
import { GitLab } from "./gitlab.ts";
import { redact } from "../security/sanitization.ts";
const names = [
  "list_github_repositories",
  "search_github_code",
  "get_github_file",
  "list_github_commits",
  "get_github_commit",
  "list_github_issues",
  "get_github_issue",
  "list_github_pull_requests",
  "get_github_pull_request",
  "list_gitlab_projects",
  "search_gitlab_repository",
  "get_gitlab_file",
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
    return names
      .filter((n) => (n.includes("_github_") ? !!this.github : !!this.gitlab))
      .map((name) => ({
        type: "function",
        function: {
          name,
          description: `Read only: ${name.replaceAll("_", " ")}. Repository/project must be an exact identifier from list. Search is bounded; use page to continue.`,
          parameters: z.toJSONSchema(schema),
        },
      }));
  }
  async execute(name: string, raw: string, signal?: AbortSignal) {
    if (!names.includes(name as (typeof names)[number]))
      throw new Error("Tool denied by read-only registry");
    const a = schema.parse(JSON.parse(raw));
    if (
      name.startsWith("get_") &&
      !name.endsWith("_file") &&
      !name.endsWith("_status") &&
      !name.endsWith("_commit") &&
      !a.number
    )
      throw new Error("Issue or request number required");
    if (name.includes("search_") && !a.query)
      throw new Error("Search query required");
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
