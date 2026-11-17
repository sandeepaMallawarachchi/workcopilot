import { describe, it, expect, vi } from "vitest";
import {
  activation,
  authorized,
  normalizePhone,
  retryDelay,
  assertReadOnly,
} from "../packages/agent-core/src/services/policies";
import {
  webhookHandler,
  verifySignature,
} from "../packages/agent-core/src/services/webhook";
import { groq } from "../packages/agent-core/src/providers/groq";
import {
  GitHub,
  resolveGitHubRepositories,
} from "../packages/agent-core/src/tools/github";
import { GitLab, resolveGitLabProjects } from "../packages/agent-core/src/tools/gitlab";
import { Registry } from "../packages/agent-core/src/tools/registry";
import { redact, safePath } from "../packages/agent-core/src/security/sanitization";
import { contextFor } from "../packages/agent-core/src/services/conversation";
import {
  sendTypingIndicator,
  sendWhatsApp,
} from "../packages/agent-core/src/services/delivery";
import { runAgent } from "../packages/agent-core/src/services/agent";
import { splitReply } from "../packages/agent-core/src/services/response";
const secret = "test-app-secret";
async function signature(body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return (
    "sha256=" +
    Array.from(new Uint8Array(signed), (x) => x.toString(16).padStart(2, "0")).join("")
  );
}
function payload(type = "text") {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "test-phone" },
              messages: [
                {
                  id: "wamid.1",
                  from: "94771234567",
                  type,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: "@ai මේ repo එක බලන්න" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}
const fake = (status: number, data: unknown = {}) =>
  vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
describe("Meta webhook", () => {
  const config = {
    verifyToken: "verify",
    appSecret: secret,
    phoneId: "test-phone",
    businessId: "waba",
    accept: vi.fn(async () => {}),
  };
  it("returns challenge for a valid verification", async () =>
    expect(
      await (
        await webhookHandler(config)(
          new Request(
            "https://example.test/?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=123",
          ),
        )
      ).text(),
    ).toBe("123"));
  it("rejects invalid verification tokens", async () =>
    expect(
      (
        await webhookHandler(config)(
          new Request(
            "https://example.test/?hub.mode=subscribe&hub.verify_token=no&hub.challenge=123",
          ),
        )
      ).status,
    ).toBe(403));
  it("validates signed raw payloads", async () => {
    const body = payload();
    expect(await verifySignature(body, await signature(body), secret)).toBe(true);
  });
  it("rejects modified payloads and malformed signatures", async () => {
    const body = payload();
    expect(await verifySignature(body + " ", await signature(body), secret)).toBe(false);
    expect(await verifySignature(body, "sha256=bad", secret)).toBe(false);
  });
  it("accepts eligible text and preserves mixed language", async () => {
    const accept = vi.fn(async () => {}),
      body = payload();
    const res = await webhookHandler({ ...config, accept })(
      new Request("https://example.test", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": await signature(body) },
      }),
    );
    expect(res.status).toBe(200);
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+94771234567",
        text: "@ai මේ repo එක බලන්න",
      }),
    );
  });
  it("rejects unsigned posts without touching storage", async () => {
    const accept = vi.fn();
    const res = await webhookHandler({ ...config, accept })(
      new Request("https://example.test", { method: "POST", body: payload() }),
    );
    expect(res.status).toBe(401);
    expect(accept).not.toHaveBeenCalled();
  });
  it("ignores unsupported messages", async () => {
    const accept = vi.fn();
    const body = payload("image");
    await webhookHandler({ ...config, accept })(
      new Request("https://example.test", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": await signature(body) },
      }),
    );
    expect(accept).not.toHaveBeenCalled();
  });
  it("returns 503 if durable storage fails, allowing Meta retry", async () => {
    const body = payload();
    const res = await webhookHandler({
      ...config,
      accept: async () => {
        throw new Error("DB down");
      },
    })(
      new Request("https://example.test", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": await signature(body) },
      }),
    );
    expect(res.status).toBe(503);
  });
  it("ignores other phone IDs and status-only events", async () => {
    const accept = vi.fn();
    for (const body of [
      payload().replace("test-phone", "another-phone"),
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba",
            changes: [
              {
                field: "messages",
                value: { statuses: [{ status: "delivered" }] },
              },
            ],
          },
        ],
      }),
    ]) {
      await webhookHandler({ ...config, accept })(
        new Request("https://example.test", {
          method: "POST",
          body,
          headers: { "x-hub-signature-256": await signature(body) },
        }),
      );
    }
    expect(accept).not.toHaveBeenCalled();
  });
});
describe("authorization and activation", () => {
  const c = { active: true, ai_access: true };
  it("ignores unknown contacts", () =>
    expect(authorized(null, true, "@ai hello")).toBeNull());
  it("ignores blocked contacts", () => {
    expect(authorized({ ...c, active: false }, true, "@ai hello")).toBeNull();
    expect(authorized({ ...c, ai_access: false }, true, "@ai hello")).toBeNull();
  });
  it("ignores ordinary messages and embedded activation", () => {
    expect(authorized(c, true, "Hello machan")).toBeNull();
    expect(activation("hello @ai")).toBeNull();
    expect(activation("@aix hello")).toBeNull();
  });
  it("accepts case insensitive leading activation", () =>
    expect(authorized(c, true, "  @AI repo eka check karanna")).toBe(
      "repo eka check karanna",
    ));
  it("matches Sinhala and Singlish without translation", () => {
    expect(activation("@ai මේ project එකේ error එක මොකක්ද?")).toBe(
      "මේ project එකේ error එක මොකක්ද?",
    );
    expect(activation("@ai machan email config eka")).toBe("machan email config eka");
  });
  it("global disable overrides allowed contacts", () =>
    expect(authorized(c, false, "@ai hello")).toBeNull());
  it("normalizes international phone numbers only", () => {
    expect(normalizePhone("+94 (77) 123-4567")).toBe("+94771234567");
    expect(() => normalizePhone("0771234567")).toThrow();
  });
});
describe("real API adapters with mocked networks", () => {
  it("parses Groq function calls", async () => {
    const f = fake(200, {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "1",
                type: "function",
                function: { name: "list_github_repositories", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });
    const response = await groq("key", "configured-model", f)([], []);
    expect(response.tool_calls?.[0].function.name).toBe("list_github_repositories");
    expect(JSON.parse(String(f.mock.calls[0][1]?.body)).model).toBe("configured-model");
  });
  it("rejects malformed Groq calls", async () => {
    await expect(
      groq(
        "k",
        "m",
        fake(200, {
          choices: [{ message: { tool_calls: [{ function: { arguments: {} } }] } }],
        }),
      )([], []),
    ).rejects.toThrow("Invalid Groq");
  });
  it("normalizes GitHub errors without leaking error bodies", async () => {
    await expect(
      new GitHub("token", ["o/r"], fake(403, { secret: "never-log" })).run(
        "list_github_commits",
        { repository: "o/r", page: 1 },
      ),
    ).rejects.toThrow("github API 403");
  });
  it("normalizes GitLab rate limit errors", async () => {
    await expect(
      new GitLab("t", ["g/p"], "https://gitlab.com", fake(429)).run(
        "list_gitlab_commits",
        { project: "g/p", page: 1 },
      ),
    ).rejects.toMatchObject({ retryable: true, status: 429 });
  });
  it("denies repositories before an HTTP call", async () => {
    const f = fake(200);
    await expect(
      new GitHub("t", ["o/r"], f).run("get_github_file", {
        repository: "other/private",
        path: "code.ts",
        page: 1,
      }),
    ).rejects.toThrow("allowlisted");
    expect(f).not.toHaveBeenCalled();
  });
  it("uses bounded GitHub tree and blob APIs for App-compatible search", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          tree: [
            { type: "blob", path: "src/email.ts", size: 40, sha: "abc" },
            { type: "blob", path: ".env", size: 40, sha: "def" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          encoding: "base64",
          content: btoa("const email = brevo();"),
        }),
      );
    const data = await new GitHub("t", ["o/r"], f, [".env"]).run("search_github_code", {
      repository: "o/r",
      query: "brevo",
      page: 1,
    });
    expect(data).toMatchObject({
      searched: ["src/email.ts"],
      matches: [{ path: "src/email.ts" }],
    });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("refuses writes without needing an approval flag", async () => {
    expect(() => assertReadOnly("POST")).toThrow("Read-only");
    await expect(
      new Registry().execute("delete_github_repository", "{}"),
    ).rejects.toThrow("read-only");
  });
  it("validates tool args and denies arbitrary fields", async () => {
    const registry = new Registry(new GitHub("t", ["o/r"], fake(200)));
    await expect(
      registry.execute(
        "get_github_file",
        JSON.stringify({ repository: "o/r", path: "../.env" }),
      ),
    ).rejects.toThrow();
    await expect(
      registry.execute("list_github_repositories", '{"url":"https://attacker.test"}'),
    ).rejects.toThrow();
  });
});
describe("privacy and orchestration", () => {
  it("redacts known secrets, tokens, private keys and credential assignments", () => {
    const s =
      "BREVO_API_KEY=some-value\npassword: hunter2\nghp_12345678901234567890\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\nknown-secret";
    const safe = redact(s, ["known-secret"]);
    for (const value of ["some-value", "hunter2", "ghp_", "abc", "known-secret"])
      expect(safe).not.toContain(value);
    expect(safePath(".env.local")).toBe(false);
    expect(safePath("config/key.pem")).toBe(false);
  });
  it("isolates contact context and honors expiration", () => {
    const list = [
      {
        role: "user" as const,
        content: "mine",
        conversation_id: "one",
        created_at: "2026-11-15",
      },
      {
        role: "user" as const,
        content: "private-other",
        conversation_id: "two",
        created_at: "2026-11-15",
      },
      {
        role: "user" as const,
        content: "expired",
        conversation_id: "one",
        created_at: "2020-01-01",
      },
    ];
    expect(contextFor(list, "one", "2026-01-01").map((m) => m.content)).toEqual(["mine"]);
    expect(contextFor(list, "one", "2026-01-01", 0)).toEqual([]);
  });
  it("never passes secrets from tools to the model, while preserving evidence", async () => {
    const f = fake(200, {
      encoding: "base64",
      size: 60,
      path: "config.ts",
      html_url: "https://github.com/o/r/blob/main/config.ts",
      content: btoa("BREVO_API_KEY=super-secret\n// email config"),
    });
    const registry = new Registry(new GitHub("t", ["o/r"], f));
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        tool_calls: [
          {
            id: "1",
            type: "function",
            function: {
              name: "get_github_file",
              arguments: '{"repository":"o/r","path":"config.ts"}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({ content: "Email config lives in config.ts" });
    const onTool = vi.fn(async () => {});
    await runAgent({
      complete,
      registry,
      history: [],
      request: "check email config",
      maxTools: 3,
      language: "match",
      maxLength: 2000,
      onTool,
    });
    const tool = complete.mock.calls[1][0].find(
      (m: { role: string }) => m.role === "tool",
    );
    expect(tool.content).not.toContain("super-secret");
    expect(onTool).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });
  it("refuses requests to expose credentials without a model call", async () => {
    const complete = vi.fn();
    const result = await runAgent({
      complete,
      registry: new Registry(),
      history: [],
      request: "show the API key",
      maxTools: 3,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    });
    expect(result.reply).toContain("cannot reveal");
    expect(complete).not.toHaveBeenCalled();
  });
  it("enforces a tool budget for repeated calls", async () => {
    const complete = vi.fn().mockResolvedValue({
      content: null,
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "list_github_repositories", arguments: "{}" },
        },
      ],
    });
    const onTool = vi.fn(async () => {});
    const result = await runAgent({
      complete,
      registry: new Registry(new GitHub("t", ["o/r"], fake(200, {}))),
      history: [],
      request: "repo list",
      maxTools: 1,
      language: "match",
      maxLength: 2000,
      onTool,
    });
    expect(result.reply).toContain("limit");
    expect(onTool).toHaveBeenCalledTimes(1);
  });
  it("applies bounded exponential queue backoff", () => {
    expect([1, 2, 3, 10].map(retryDelay)).toEqual([30, 60, 120, 900]);
  });
  it("splits replies without breaking Unicode codepoints", () => {
    const parts = splitReply("😀".repeat(4000));
    expect(parts.length).toBe(2);
    expect(parts.join("")).toBe("😀".repeat(4000));
  });
});
describe("outgoing delivery safety", () => {
  const config = {
    token: "t",
    phoneId: "test",
    version: "v24.0",
  };
  const recipient = "+94771234567";
  it("rejects malformed recipients before making a request", async () => {
    const f = fake(200);
    expect((await sendWhatsApp(config, "12345", "hello", f)).status).toBe("failed");
    expect(f).not.toHaveBeenCalled();
  });
  it("records outgoing IDs", async () =>
    expect(
      await sendWhatsApp(
        config,
        recipient,
        "hello",
        fake(200, { messages: [{ id: "wamid.out" }] }),
      ),
    ).toMatchObject({ status: "sent", id: "wamid.out" }));
  it("does not blindly retry network timeouts", async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout"));
    expect((await sendWhatsApp(config, recipient, "hello", f)).status).toBe(
      "manual_review",
    );
  });
  it("retries only explicit rate-limit rejections", async () =>
    expect((await sendWhatsApp(config, recipient, "hello", fake(429))).status).toBe(
      "pending",
    ));
  it("surfaces Meta's error code and hint without leaking the token", async () => {
    const result = await sendWhatsApp(
      config,
      recipient,
      "hello",
      fake(400, {
        error: {
          message: "Recipient phone number not in allowed list",
          code: 131030,
          fbtrace_id: "abc",
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.error).toContain("code 131030");
    expect(result.error).toContain("allowed list");
    const leaked = await sendWhatsApp(
      { ...config, token: "EAAsecretsecretsecretsecret123" },
      recipient,
      "hello",
      fake(401, {
        error: { message: "bad token EAAsecretsecretsecretsecret123", code: 190 },
      }),
    );
    expect(leaked.error).not.toContain("EAAsecret");
    expect(leaked.error).toContain("expired");
  });
  it("permanent failures and ambiguous server errors are distinct", async () => {
    expect((await sendWhatsApp(config, recipient, "hello", fake(400))).status).toBe(
      "failed",
    );
    expect((await sendWhatsApp(config, recipient, "hello", fake(500))).status).toBe(
      "manual_review",
    );
  });
});

describe("additional grounding and data boundaries", () => {
  it("cannot answer repository questions without successful API evidence", async () => {
    const complete = vi
      .fn()
      .mockResolvedValue({ content: "Your latest commit fixed auth." });
    const result = await runAgent({
      complete,
      registry: new Registry(),
      history: [],
      request: "What is my latest commit?",
      maxTools: 3,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    });
    expect(result.reply).toContain("No repository integration is connected");
    expect(result.reply).not.toContain("fixed auth");
    expect(complete).not.toHaveBeenCalled();
    const connected = await runAgent({
      complete,
      registry: new Registry(new GitHub("t", ["o/r"], fake(200, []))),
      history: [],
      request: "What is my latest commit?",
      maxTools: 3,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    });
    expect(connected.reply).toContain("not verified");
    expect(connected.reply).not.toContain("fixed auth");
  });
  it("recovers once from Groq tool_use_failed hallucinated tools", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "tool_use_failed", message: "Tool choice is none" },
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }), {
          status: 200,
        }),
      );
    const response = await groq("k", "m", f)([], []);
    expect(response.content).toBe("Hello");
    expect(f).toHaveBeenCalledTimes(2);
    await expect(
      groq("k", "m", fake(400, { error: { code: "tool_use_failed" } }))([], []),
    ).rejects.toThrow("Groq request failed (400 tool_use_failed)");
  });
  it("bounds the complete prompt and tool schemas before making a model request", async () => {
    const complete = vi.fn();
    const result = await runAgent({
      complete,
      registry: new Registry(),
      history: [],
      request: "x".repeat(50000),
      maxTools: 3,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    });
    expect(result.reply).toContain("token budget");
    expect(complete).not.toHaveBeenCalled();
  });
  it("excludes GitLab code-search matches blocked by the owner's rules", async () => {
    const hits = [
      { path: ".env", data: "PRIVATE=abc" },
      { path: "src/email.ts", data: "const mailer = brevo" },
    ];
    const search = (blocked: string[]) =>
      new GitLab("t", ["g/p"], "https://gitlab.com", fake(200, hits), blocked).run(
        "search_gitlab_repository",
        { project: "g/p", query: "brevo", page: 1 },
      );
    const blocked = JSON.stringify(await search([".env"]));
    expect(blocked).not.toContain("PRIVATE");
    expect(blocked).toContain("src/email.ts");
    // Nothing is blocked unless the owner adds a rule.
    expect(JSON.stringify(await search([]))).toContain("PRIVATE");
  });
});

describe("provider history serialization", () => {
  it("sends only supported message fields to Groq", async () => {
    const history = contextFor(
      [
        {
          role: "assistant",
          content: "Earlier response",
          conversation_id: "a",
          created_at: "2026-11-15",
        },
      ],
      "a",
      "2026-01-01",
    );
    const complete = vi.fn().mockResolvedValue({ content: "Hello" });
    await runAgent({
      complete,
      registry: new Registry(),
      history,
      request: "hello",
      maxTools: 2,
      language: "match",
      maxLength: 1000,
      onTool: async () => {},
    });
    expect(complete.mock.calls[0][0][1]).toEqual({
      role: "assistant",
      content: "Earlier response",
    });
  });
});

describe("latency and token efficiency", () => {
  it("keeps tool schemas compact and tool-specific", () => {
    const registry = new Registry(new GitHub("t", ["o/r"]), new GitLab("t", ["g/p"]));
    const defs = registry.definitions();
    expect(
      JSON.stringify(new Registry(new GitHub("t", ["o/r"])).definitions()).length,
    ).toBeLessThan(3000);
    const file = defs.find((d) => d.function.name === "get_github_file")!;
    expect(file.function.parameters).toMatchObject({
      required: ["repository", "path"],
    });
    const list = defs.find((d) => d.function.name === "list_github_repositories")!;
    expect(Object.keys(list.function.parameters.properties as object)).toEqual(["page"]);
    expect(registry.scope()).toContain("GitHub repositories: o/r");
  });
  it("trims long history messages", () => {
    const out = contextFor(
      [
        {
          role: "assistant",
          content: "x".repeat(5000),
          conversation_id: "c",
          created_at: "2026-11-16",
        },
      ],
      "c",
      "2026-01-01",
    );
    expect(out[0].content.length).toBeLessThan(1300);
  });
  it("waits out short Groq rate limits instead of failing", async () => {
    vi.useFakeTimers();
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          status: 200,
        }),
      );
    const pending = groq("k", "m", f)([], []);
    await vi.advanceTimersByTimeAsync(1500);
    expect((await pending).content).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
  it("sends a WhatsApp typing indicator for the incoming message", async () => {
    const f = fake(200, { success: true });
    expect(
      await sendTypingIndicator(
        { token: "t", phoneId: "p", version: "v24.0" },
        "wamid.in",
        f,
      ),
    ).toBe(true);
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toMatchObject({
      status: "read",
      message_id: "wamid.in",
      typing_indicator: { type: "text" },
    });
  });
});

describe("all-repositories selection", () => {
  it("resolves * to the installation's repositories", async () => {
    const f = fake(200, { repositories: [{ full_name: "o/a" }, { full_name: "o/b" }] });
    expect(await resolveGitHubRepositories(["*"], "t", undefined, f)).toEqual([
      "o/a",
      "o/b",
    ]);
    expect(String(f.mock.calls[0][0])).toContain("/installation/repositories");
  });
  it("leaves explicit selections untouched without API calls", async () => {
    const f = fake(200, {});
    expect(await resolveGitHubRepositories(["o/r"], "t", undefined, f)).toEqual(["o/r"]);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("repository structure tool", () => {
  it("returns a compact tree without noise folders in one call", async () => {
    const f = fake(200, {
      tree: [
        { path: "src", type: "tree" },
        { path: "src/index.ts", type: "blob" },
        { path: "node_modules/x/index.js", type: "blob" },
        { path: "README.md", type: "blob" },
      ],
    });
    const out = (await new GitHub("t", ["o/r"], f).run("get_github_tree", {
      repository: "o/r",
      page: 1,
    })) as { entries: string; total: number };
    expect(out.entries).toBe("README.md\nsrc/\nsrc/index.ts");
    expect(out.total).toBe(3);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("exposes the tree tool with an optional path", async () => {
    const def = new Registry(new GitHub("t", ["o/r"]))
      .definitions()
      .find((d) => d.function.name === "get_github_tree")!;
    expect(def.function.parameters).toMatchObject({ required: ["repository"] });
    await expect(
      new Registry(new GitHub("t", ["o/r"], fake(200, { tree: [] }))).execute(
        "get_github_tree",
        JSON.stringify({ repository: "o/r" }),
      ),
    ).resolves.toContain("entries");
  });
});

describe("tool argument normalization", () => {
  it("treats empty or root paths as the whole repository", async () => {
    const registry = new Registry(
      new GitHub(
        "t",
        ["o/r"],
        vi.fn<typeof fetch>().mockImplementation(
          async () =>
            new Response(JSON.stringify({ tree: [{ path: "a.ts", type: "blob" }] }), {
              status: 200,
            }),
        ),
      ),
    );
    for (const path of ["", "/", ".", "./"])
      await expect(
        registry.execute("get_github_tree", JSON.stringify({ repository: "o/r", path })),
      ).resolves.toContain("a.ts");
  });
  it("lists allowed repositories without API calls", async () => {
    const f = fake(200, {});
    const out = (await new GitHub("t", ["o/a", "o/b"], f).run(
      "list_github_repositories",
      { page: 1 },
    )) as { repositories: { html_url: string }[] };
    expect(out.repositories[1].html_url).toBe("https://github.com/o/b");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("user-facing failure messages", () => {
  it("explains common failures in plain language", async () => {
    const { describeFailure, failureNotice } =
      await import("../packages/agent-core/src/services/errors");
    expect(describeFailure("Groq request failed (429 rate_limit_exceeded)")).toContain(
      "busy",
    );
    expect(
      describeFailure("Meta rejected message (401): code 190; Authentication Error"),
    ).toContain("access token");
    expect(describeFailure("github API 404")).toContain("repository");
    expect(describeFailure(null)).toContain("Something went wrong");
    expect(failureNotice("timeout")).toMatch(/^⚠️ Sorry/);
  });
});

describe("GitLab all-projects selection", () => {
  it("resolves * to member projects", async () => {
    const f = fake(200, [{ path_with_namespace: "g/a" }, { path_with_namespace: "g/b" }]);
    expect(await resolveGitLabProjects(["*"], "t", undefined, undefined, f)).toEqual([
      "g/a",
      "g/b",
    ]);
    expect(String(f.mock.calls[0][0])).toContain("membership=true");
  });
  it("keeps explicit selections and refuses non-GitLab.com hosts", async () => {
    const f = fake(200, []);
    expect(await resolveGitLabProjects(["g/p"], "t", undefined, undefined, f)).toEqual([
      "g/p",
    ]);
    expect(f).not.toHaveBeenCalled();
    await expect(
      resolveGitLabProjects(["*"], "t", "https://evil.example", undefined, f),
    ).rejects.toThrow("GitLab.com only");
  });
  it("lists projects locally", async () => {
    const f = fake(200, {});
    const out = (await new GitLab("t", ["g/a"], "https://gitlab.com", f).run(
      "list_gitlab_projects",
      { page: 1 },
    )) as { projects: { web_url: string }[] };
    expect(out.projects[0].web_url).toBe("https://gitlab.com/g/a");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("integration access policy", () => {
  it("matches .gitignore-style blocked patterns", async () => {
    const { pathBlocked, parseBlockedPatterns } =
      await import("../packages/agent-core/src/security/access");
    const rules = parseBlockedPatterns(
      "*.env\nconfig/secrets/\ndocs/private/**, *.tfstate",
    );
    expect(pathBlocked("apps/web/prod.env", rules)).toBe(true);
    expect(pathBlocked("config/secrets/db.json", rules)).toBe(true);
    expect(pathBlocked("config/secrets", rules)).toBe(true);
    expect(pathBlocked("other/config/secrets/x", rules)).toBe(false); // anchored
    expect(pathBlocked("docs/private/a/b.md", rules)).toBe(true);
    expect(pathBlocked("infra/terraform.tfstate", rules)).toBe(true);
    expect(pathBlocked("src/env.ts", rules)).toBe(false);
    expect(pathBlocked("README.md", rules)).toBe(false);
    expect(pathBlocked("node_modules/x", parseBlockedPatterns("node_modules"))).toBe(
      true,
    );
    expect(() => parseBlockedPatterns("../etc/passwd")).toThrow("Invalid");
  });
  it("never reads, lists or searches blocked files", async () => {
    const tree = {
      tree: [
        { path: "src/app.ts", type: "blob", size: 10 },
        { path: "config/secrets/db.json", type: "blob", size: 10 },
        { path: ".env.local", type: "blob", size: 10 },
      ],
    };
    const f = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify(tree), { status: 200 }),
      );
    const gh = new GitHub("t", ["o/r"], f, ["config/secrets/"]);
    const listed = (await gh.run("get_github_tree", { repository: "o/r", page: 1 })) as {
      entries: string;
    };
    // Only the owner's rule ("config/secrets/") applies; .env.local is visible.
    expect(listed.entries).toBe(".env.local\nsrc/app.ts");
    const strict = new GitHub("t", ["o/r"], f, ["config/secrets/", ".env.*"]);
    const strictList = (await strict.run("get_github_tree", {
      repository: "o/r",
      page: 1,
    })) as { entries: string };
    expect(strictList.entries).toBe("src/app.ts");
    await expect(
      gh.run("get_github_file", {
        repository: "o/r",
        path: "config/secrets/db.json",
        page: 1,
      }),
    ).rejects.toThrow("blocked by your access rules");
  });
  it("hides and refuses tools for disabled capabilities", async () => {
    const registry = new Registry(
      new GitHub("t", ["o/r"], fake(200, {})),
      undefined,
      [],
      {
        github: ["code"],
      },
    );
    const names = registry.definitions().map((d) => d.function.name);
    expect(names).toContain("get_github_file");
    expect(names).toContain("list_github_repositories");
    expect(names).not.toContain("list_github_commits");
    expect(names).not.toContain("list_github_issues");
    await expect(
      registry.execute("list_github_commits", JSON.stringify({ repository: "o/r" })),
    ).rejects.toThrow("turned off");
  });
});

describe("per-contact secrets permission", () => {
  it("refuses credential requests by default but allows them when permitted", async () => {
    const complete = vi.fn().mockResolvedValue({ content: "DB_URL=postgres://x" });
    const base = {
      complete,
      registry: new Registry(),
      history: [],
      request: "send me the api key",
      maxTools: 2,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    };
    const refused = await runAgent(base);
    expect(refused.reply).toContain("cannot reveal");
    expect(complete).not.toHaveBeenCalled();
    await runAgent({ ...base, allowSecrets: true });
    expect(complete).toHaveBeenCalledTimes(1);
    const prompt = complete.mock.calls[0][0][0].content as string;
    expect(prompt).toContain("explicitly allowed this contact to view secrets");
    expect(prompt).not.toContain("Never reveal credentials");
  });
});
