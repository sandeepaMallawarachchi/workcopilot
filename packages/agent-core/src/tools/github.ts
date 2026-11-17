import { api, array, record, project, decodeBase64 } from "./http.ts";
import { pathBlocked } from "../security/access.ts";
import { ServiceError } from "../services/policies.ts";
export type ToolArgs = {
  repository?: string;
  project?: string;
  path?: string;
  ref?: string;
  query?: string;
  number?: number;
  sha?: string;
  page: number;
};
export class GitHub {
  constructor(
    private token: string,
    readonly allowed: string[],
    private fetcher: typeof fetch = fetch,
    /** User-defined blocked path patterns (in addition to built-in ones). */
    private blocked: string[] = [],
  ) {}
  async run(name: string, a: ToolArgs, signal?: AbortSignal): Promise<unknown> {
    const get = (path: string) =>
      api("https://api.github.com" + path, this.token, "github", signal, this.fetcher);
    if (name === "list_github_repositories") {
      // Names are already known (and verified on save / resolved from the
      // installation), so answer locally: no per-repository API round trips.
      const slice = this.allowed.slice((a.page - 1) * 50, a.page * 50);
      return {
        repositories: slice.map((full_name) => ({
          full_name,
          html_url: `https://github.com/${full_name}`,
        })),
        page: a.page,
        has_more: this.allowed.length > a.page * 50,
      };
    }
    const repo = a.repository;
    if (!repo || !this.allowed.includes(repo))
      throw new ServiceError("Repository is not allowlisted");
    const base = "/repos/" + repo;
    const paging = `per_page=20&page=${a.page}`;
    const ref = encodeURIComponent(a.ref ?? "HEAD");
    if (name === "get_github_file") {
      if (a.path && pathBlocked(a.path, this.blocked))
        throw new ServiceError("This file is blocked by your access rules");
      // Only the owner's blocked-path rules apply (no built-in file blocks).
      if (!a.path) throw new ServiceError("File path required");
      const r = record(
        await get(
          `${base}/contents/${a.path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`,
        ),
      );
      if (r.encoding !== "base64" || Number(r.size) > 32000)
        throw new ServiceError("File is too large or not a text file");
      return {
        path: r.path,
        source: r.html_url,
        excerpt: decodeBase64(String(r.content)).slice(0, 6000),
        truncated: Number(r.size) > 6000,
      };
    }
    if (name === "get_github_tree") {
      // One call answers "folder structure" questions instead of many searches.
      const tree = record(await get(`${base}/git/trees/${ref}?recursive=1`));
      return {
        repository: repo,
        ref: a.ref ?? "HEAD",
        ...formatTree(
          array(tree.tree).map((x) => ({
            path: String(x.path),
            dir: x.type === "tree",
          })),
          a.path,
          this.blocked,
        ),
        source: `https://github.com/${repo}/tree/${a.ref ?? "HEAD"}${a.path ? "/" + a.path : ""}`,
        truncated_by_github: tree.truncated === true,
      };
    }
    if (name === "search_github_code") {
      // Bounded tree/content search works with GitHub App installation tokens, unlike code search.
      if (!a.query) throw new ServiceError("Search query required");
      const tree = record(await get(`${base}/git/trees/${ref}?recursive=1`));
      const candidates = array(tree.tree).filter(
        (x) =>
          x.type === "blob" &&
          Number(x.size) <= 32000 &&
          !pathBlocked(String(x.path), this.blocked) &&
          !/\.(png|jpg|gif|woff2?|pdf|zip|lock|svg|map)$/i.test(String(x.path)),
      );
      const words = a.query.toLowerCase().split(/\s+/);
      candidates.sort(
        (x, y) =>
          Number(words.some((w) => String(y.path).toLowerCase().includes(w))) -
          Number(words.some((w) => String(x.path).toLowerCase().includes(w))),
      );
      const selected = candidates.slice((a.page - 1) * 8, a.page * 8);
      const matches = [];
      for (const file of selected) {
        const r = record(await get(`${base}/git/blobs/${file.sha}`));
        if (r.encoding !== "base64") continue;
        const content = decodeBase64(String(r.content));
        const lines = content.split("\n");
        const hits = lines
          .flatMap((line, i) =>
            words.some((w) => line.toLowerCase().includes(w))
              ? [{ line: i + 1, excerpt: line.slice(0, 300) }]
              : [],
          )
          .slice(0, 8);
        if (hits.length || words.some((w) => String(file.path).toLowerCase().includes(w)))
          matches.push({
            path: file.path,
            source: `https://github.com/${repo}/blob/${ref}/${String(file.path).split("/").map(encodeURIComponent).join("/")}`,
            hits,
          });
      }
      return {
        strategy: "bounded repository tree and content search",
        searched: selected.map((x) => x.path),
        matches,
        page: a.page,
        has_more: candidates.length > a.page * 8,
        tree_truncated: tree.truncated,
      };
    }
    const routes: Record<string, string> = {
      list_github_commits: `/commits?${paging}`,
      get_github_commit: `/commits/${encodeURIComponent(a.sha ?? "HEAD")}`,
      list_github_issues: `/issues?state=all&${paging}`,
      get_github_issue: `/issues/${a.number}`,
      list_github_pull_requests: `/pulls?state=all&${paging}`,
      get_github_pull_request: `/pulls/${a.number}`,
    };
    if (!routes[name]) throw new ServiceError("Unknown GitHub tool");
    return {
      data: project(await get(base + routes[name]), [
        "sha",
        "html_url",
        "number",
        "title",
        "state",
        "body",
        "commit",
        "created_at",
        "updated_at",
        "merged_at",
        "user",
        "head",
        "base",
      ]),
      page: a.page,
      per_page: 20,
    };
  }
}

/**
 * Resolves the "*" (all repositories) selection to concrete full names that the
 * credential can read: the GitHub App installation's repositories, falling back
 * to the user's repositories for a development token. Bounded to 300.
 */
export async function resolveGitHubRepositories(
  allowed: string[],
  token: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  if (!allowed.includes("*")) return allowed;
  const names = new Set(allowed.filter((r) => r !== "*"));
  const collect = async (path: string, key?: string) => {
    for (let page = 1; page <= 3; page++) {
      const data = await api(
        `https://api.github.com${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        token,
        "github",
        signal,
        fetcher,
      );
      const list = key ? record(data)[key] : data;
      const repos = array(list);
      for (const repo of repos)
        if (typeof repo.full_name === "string") names.add(repo.full_name);
      if (repos.length < 100) break;
    }
  };
  try {
    await collect("/installation/repositories", "repositories");
  } catch {
    await collect("/user/repos?affiliation=owner,collaborator,organization_member");
  }
  return [...names];
}

const NOISE =
  /(^|\/)(node_modules|\.git|dist|build|out|\.next|coverage|vendor|__pycache__|\.venv|\.turbo|\.cache)(\/|$)/;
/**
 * Compact, token-efficient directory listing: one path per line, directories
 * end with "/", noise folders skipped, bounded to 200 entries.
 */
export function formatTree(
  entries: { path: string; dir: boolean }[],
  under?: string,
  blocked: string[] = [],
  limit = 200,
) {
  const prefix = under ? under.replace(/\/+$/, "") + "/" : "";
  const kept = entries
    .filter(
      (e) =>
        e.path.startsWith(prefix) && !NOISE.test(e.path) && !pathBlocked(e.path, blocked),
    )
    .map((e) => e.path + (e.dir ? "/" : ""))
    .sort();
  return {
    entries: kept.slice(0, limit).join("\n"),
    total: kept.length,
    truncated: kept.length > limit,
  };
}
