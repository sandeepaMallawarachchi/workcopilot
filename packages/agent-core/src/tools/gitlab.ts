import { formatTree } from "./github.ts";
import { api, project, record, decodeBase64, array } from "./http.ts";
import type { ToolArgs } from "./github.ts";
import { pathBlocked } from "../security/access.ts";
import { ServiceError } from "../services/policies.ts";
export class GitLab {
  constructor(
    private token: string,
    readonly allowed: string[],
    private base = "https://gitlab.com",
    private fetcher: typeof fetch = fetch,
    /** User-defined blocked path patterns (in addition to built-in ones). */
    private blocked: string[] = [],
  ) {
    if (new URL(base).origin !== "https://gitlab.com")
      throw new ServiceError(
        "Phase 1 permits GitLab.com only; self-hosted requires an audited host allowlist",
      );
  }
  async run(name: string, a: ToolArgs, signal?: AbortSignal): Promise<unknown> {
    const get = (path: string) =>
      api(
        this.base.replace(/\/$/, "") + "/api/v4" + path,
        this.token,
        "gitlab",
        signal,
        this.fetcher,
      );
    if (name === "list_gitlab_projects") {
      // Paths are already known (verified on save / resolved from membership):
      // answer locally instead of one API call per project.
      const base = this.base.replace(/\/$/, "");
      return {
        projects: this.allowed
          .slice((a.page - 1) * 50, a.page * 50)
          .map((path) => ({ path_with_namespace: path, web_url: `${base}/${path}` })),
        page: a.page,
        has_more: this.allowed.length > a.page * 50,
      };
    }
    const id = a.project;
    if (!id || !this.allowed.includes(id))
      throw new ServiceError("Project is not allowlisted");
    const base = "/projects/" + encodeURIComponent(id);
    const paging = `per_page=20&page=${a.page}`;
    if (name === "get_gitlab_file") {
      if (a.path && pathBlocked(a.path, this.blocked))
        throw new ServiceError("This file is blocked by your access rules");
      // Only the owner's blocked-path rules apply (no built-in file blocks).
      if (!a.path) throw new ServiceError("File path required");
      const f = record(
        await get(
          `${base}/repository/files/${encodeURIComponent(a.path)}?ref=${encodeURIComponent(a.ref ?? "HEAD")}`,
        ),
      );
      if (Number(f.size) > 32000) throw new ServiceError("File exceeds safe size");
      return {
        path: f.file_path,
        excerpt: decodeBase64(String(f.content)).slice(0, 6000),
        source: `${this.base}/${id}/-/blob/${encodeURIComponent(a.ref ?? "HEAD")}/${a.path.split("/").map(encodeURIComponent).join("/")}`,
        truncated: Number(f.size) > 6000,
      };
    }
    if (name === "get_gitlab_tree") {
      const entries: { path: string; dir: boolean }[] = [];
      for (let page = 1; page <= 3; page++) {
        const items = array(
          await get(
            `${base}/repository/tree?recursive=true&per_page=100&page=${page}${a.ref ? `&ref=${encodeURIComponent(a.ref)}` : ""}${a.path ? `&path=${encodeURIComponent(a.path)}` : ""}`,
          ),
        );
        for (const x of items)
          entries.push({ path: String(x.path), dir: x.type === "tree" });
        if (items.length < 100) break;
      }
      return {
        project: id,
        ...formatTree(entries, a.path, this.blocked),
        source: `${this.base}/${id}/-/tree/${encodeURIComponent(a.ref ?? "HEAD")}${a.path ? "/" + a.path : ""}`,
      };
    }
    const routes: Record<string, string> = {
      search_gitlab_repository: `/search?scope=blobs&search=${encodeURIComponent(a.query ?? "")}&${paging}`,
      list_gitlab_commits: `/repository/commits?${paging}`,
      get_gitlab_commit: `/repository/commits/${encodeURIComponent(a.sha ?? "HEAD")}`,
      list_gitlab_issues: `/issues?scope=all&${paging}`,
      get_gitlab_issue: `/issues/${a.number}`,
      list_gitlab_merge_requests: `/merge_requests?scope=all&${paging}`,
      get_gitlab_merge_request: `/merge_requests/${a.number}`,
      get_gitlab_pipeline_status: `/pipelines?${paging}`,
    };
    if (!routes[name]) throw new ServiceError("Unknown GitLab tool");
    const result = await get(base + routes[name]);
    const filtered =
      name === "search_gitlab_repository"
        ? array(result).filter((x) => {
            const path = String(x.path ?? x.filename ?? "");
            return !pathBlocked(path, this.blocked);
          })
        : result;
    return {
      data: project(filtered, [
        "id",
        "iid",
        "title",
        "message",
        "web_url",
        "state",
        "status",
        "ref",
        "sha",
        "created_at",
        "committed_date",
        "description",
        "path",
        "filename",
        "data",
        "startline",
      ]),
      page: a.page,
      per_page: 20,
    };
  }
}

/**
 * Resolves the "*" (all projects) selection to the project paths the token's
 * user is a member of on GitLab.com. Bounded to 300.
 */
export async function resolveGitLabProjects(
  allowed: string[],
  token: string,
  base = "https://gitlab.com",
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  if (!allowed.includes("*")) return allowed;
  if (new URL(base).origin !== "https://gitlab.com")
    throw new ServiceError("Phase 1 permits GitLab.com only");
  const paths = new Set(allowed.filter((p) => p !== "*"));
  for (let page = 1; page <= 3; page++) {
    const projects = array(
      await api(
        `https://gitlab.com/api/v4/projects?membership=true&simple=true&archived=false&per_page=100&page=${page}`,
        token,
        "gitlab",
        signal,
        fetcher,
      ),
    );
    for (const p of projects)
      if (typeof p.path_with_namespace === "string") paths.add(p.path_with_namespace);
    if (projects.length < 100) break;
  }
  return [...paths];
}
