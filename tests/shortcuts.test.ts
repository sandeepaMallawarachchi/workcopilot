import { describe, it, expect } from "vitest";
import {
  availableTasks,
  intersect,
  isHelpRequest,
  parseShortcuts,
  scopeFor,
  storedShortcuts,
  welcomeText,
} from "../packages/agent-core/src/services/shortcuts";
import { GitHub } from "../packages/agent-core/src/tools/github";
import { Registry } from "../packages/agent-core/src/tools/registry";

const shortcuts = [
  { prefix: "@github", tasks: ["github:code", "github:commits"] },
  { prefix: "@email", tasks: ["email:read"] },
];

describe("prefix shortcuts", () => {
  it("validates prefixes, duplicates and tasks", () => {
    expect(parseShortcuts(shortcuts, "@ai")).toEqual(shortcuts);
    expect(() =>
      parseShortcuts([{ prefix: "@ai", tasks: ["email:read"] }], "@ai"),
    ).toThrow("more than once");
    expect(() =>
      parseShortcuts([{ prefix: "github", tasks: ["github:code"] }], "@ai"),
    ).toThrow("@ followed by");
    expect(() => parseShortcuts([{ prefix: "@x", tasks: ["nope"] }], "@ai")).toThrow(
      "at least one task",
    );
    expect(storedShortcuts(undefined)).toEqual([]);
  });
  it("lists only tasks the agent can do now", () => {
    const tasks = availableTasks({
      github: ["code", "issues"],
      gitlab: null,
      email: true,
    });
    expect(tasks.map((t) => t.id)).toEqual([
      "github:code",
      "github:issues",
      "email:read",
    ]);
  });
  it("scopes a request to the shortcut's tasks", () => {
    expect(scopeFor(null, shortcuts).all).toBe(true);
    expect(scopeFor("@removed", shortcuts).all).toBe(true); // deleted shortcut → full access
    const gh = scopeFor("@GitHub", shortcuts);
    expect(gh).toMatchObject({ github: ["code", "commits"], gitlab: null, email: false });
    expect(scopeFor("@email", shortcuts)).toMatchObject({ github: null, email: true });
    expect(intersect(["code", "issues"], ["code", "commits"])).toEqual(["code"]);
    expect(intersect(undefined, undefined)).toBeUndefined();
    expect(intersect(["code"], null)).toEqual([]);
  });
  it("sends fewer tool definitions for a focused shortcut", () => {
    const github = new GitHub("t", ["o/r"]);
    const all = new Registry(github).definitions().length;
    const scoped = new Registry(github, undefined, [], {
      github: intersect(undefined, scopeFor("@github", shortcuts).github),
    }).definitions();
    expect(scoped.length).toBeLessThan(all);
    expect(scoped.map((d) => d.function.name)).not.toContain("list_github_issues");
  });
  it("builds a WhatsApp welcome listing the prefixes", () => {
    const text = welcomeText({
      name: "Sandeepa",
      mainPrefix: "@ai",
      shortcuts,
      followupMinutes: 10,
      first: true,
    });
    expect(text).toContain("Hi Sandeepa");
    expect(text).toContain("*@github* — GitHub code & files, commits");
    expect(text).toContain("*@email* — your email");
    expect(text).toContain("@ai help");
    expect(isHelpRequest("help")).toBe(true);
    expect(isHelpRequest("Menu!")).toBe(true);
    expect(isHelpRequest("help me find the README")).toBe(false);
  });
});

describe("per-contact access", () => {
  it("combines contact access with the shortcut scope", async () => {
    const { combineScopes, scopeFromTasks, FULL_SCOPE } =
      await import("../packages/agent-core/src/services/shortcuts");
    const contact = scopeFromTasks(["github:code", "email:read"]);
    expect(combineScopes(FULL_SCOPE, contact)).toMatchObject({
      github: ["code"],
      gitlab: null,
      email: true,
      codes: false,
    });
    // @github shortcut allows code+commits; contact only code → code
    const both = combineScopes(scopeFor("@github", shortcuts), contact);
    expect(both).toMatchObject({ github: ["code"], email: false });
    expect(combineScopes(FULL_SCOPE, scopeFromTasks(null))).toEqual(FULL_SCOPE);
    expect(scopeFromTasks(["email:read", "email:codes"]).codes).toBe(true);
  });
  it("detects requests for services the contact cannot use", async () => {
    const { deniedProviders, noAccessText, scopeFromTasks } =
      await import("../packages/agent-core/src/services/shortcuts");
    const githubOnly = scopeFromTasks(["github:code"]);
    expect(deniedProviders("any unread emails?", githubOnly)).toEqual(["email"]);
    expect(deniedProviders("latest commit in projectlens", githubOnly)).toEqual([]);
    expect(deniedProviders("gitlab pipeline status", githubOnly)).toEqual(["gitlab"]);
    expect(deniedProviders("show the repo readme", scopeFromTasks([]))).toEqual([
      "github",
      "gitlab",
    ]);
    expect(deniedProviders("what's the weather", scopeFromTasks([]))).toEqual([]);
    expect(deniedProviders("emails?", scopeFromTasks(null))).toEqual([]);
    expect(noAccessText(["github", "gitlab"])).toBe(
      "🔒 You don't have access to GitHub or GitLab through WorkCopilot. Ask the owner to grant it if you need it.",
    );
  });
  it("lists only usable shortcuts in the contact's welcome", () => {
    const text = welcomeText({
      mainPrefix: "@ai",
      shortcuts,
      followupMinutes: 10,
      first: false,
      access: ["email:read"],
    });
    expect(text).toContain("@email");
    expect(text).not.toContain("@github");
    expect(text).toContain("the tools you have access to");
  });
});
