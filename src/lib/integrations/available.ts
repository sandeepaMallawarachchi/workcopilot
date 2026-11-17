import { githubToken } from "../../../packages/agent-core/src/services/credentials";
import { resolveGitHubRepositories } from "../../../packages/agent-core/src/tools/github";
import { resolveGitLabProjects } from "../../../packages/agent-core/src/tools/gitlab";

export type RepoList = { options: string[]; error?: string };

/**
 * Repositories/projects for a provider. `allowed` is the integration's saved
 * selection: ["*"] (all the credential can read) or explicit paths. Failures are
 * non-fatal: callers still let the owner type paths.
 */
export async function availableRepositories(
  provider: "github" | "gitlab",
  allowed: string[] = ["*"],
): Promise<RepoList> {
  if (!allowed.includes("*")) return { options: [...allowed].sort() };
  try {
    const signal = AbortSignal.timeout(8000);
    if (provider === "github") {
      const token = await githubToken((k) => process.env[k]);
      return { options: (await resolveGitHubRepositories(["*"], token, signal)).sort() };
    }
    const token = process.env.GITLAB_TOKEN?.trim();
    if (!token)
      return {
        options: [],
        error: "GITLAB_TOKEN is not set on the server, so the list can't be loaded.",
      };
    return {
      options: (
        await resolveGitLabProjects(
          ["*"],
          token,
          process.env.GITLAB_BASE_URL || undefined,
          signal,
        )
      ).sort(),
    };
  } catch {
    return {
      options: [],
      error:
        "Couldn't load the list from the provider. Check the server credentials; you can still type paths.",
    };
  }
}
