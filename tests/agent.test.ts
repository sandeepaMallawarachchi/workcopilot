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
import { GitHub } from "../packages/agent-core/src/tools/github";
import { GitLab } from "../packages/agent-core/src/tools/gitlab";
import { Registry } from "../packages/agent-core/src/tools/registry";
import { redact, safePath } from "../packages/agent-core/src/security/sanitization";
import { contextFor } from "../packages/agent-core/src/services/conversation";
import { sendWhatsApp } from "../packages/agent-core/src/services/delivery";
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
    const data = await new GitHub("t", ["o/r"], f).run("search_github_code", {
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
    const f = fake(200, { full_name: "o/r" });
    const result = await runAgent({
      complete,
      registry: new Registry(new GitHub("t", ["o/r"], f)),
      history: [],
      request: "repo list",
      maxTools: 1,
      language: "match",
      maxLength: 2000,
      onTool: async () => {},
    });
    expect(result.reply).toContain("limit");
    expect(f).toHaveBeenCalledTimes(1);
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
    recipients: ["+94771234567"],
  };
  it("rejects unverified test recipients before making a request", async () => {
    const f = fake(200);
    expect((await sendWhatsApp(config, "+19999999999", "hello", f)).status).toBe(
      "failed",
    );
    expect(f).not.toHaveBeenCalled();
  });
  it("records outgoing IDs", async () =>
    expect(
      await sendWhatsApp(
        config,
        config.recipients[0],
        "hello",
        fake(200, { messages: [{ id: "wamid.out" }] }),
      ),
    ).toMatchObject({ status: "sent", id: "wamid.out" }));
  it("does not blindly retry network timeouts", async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout"));
    expect((await sendWhatsApp(config, config.recipients[0], "hello", f)).status).toBe(
      "manual_review",
    );
  });
  it("retries only explicit rate-limit rejections", async () =>
    expect(
      (await sendWhatsApp(config, config.recipients[0], "hello", fake(429))).status,
    ).toBe("pending"));
  it("surfaces Meta's error code and hint without leaking the token", async () => {
    const result = await sendWhatsApp(
      config,
      config.recipients[0],
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
      config.recipients[0],
      "hello",
      fake(401, {
        error: { message: "bad token EAAsecretsecretsecretsecret123", code: 190 },
      }),
    );
    expect(leaked.error).not.toContain("EAAsecret");
    expect(leaked.error).toContain("expired");
  });
  it("permanent failures and ambiguous server errors are distinct", async () => {
    expect(
      (await sendWhatsApp(config, config.recipients[0], "hello", fake(400))).status,
    ).toBe("failed");
    expect(
      (await sendWhatsApp(config, config.recipients[0], "hello", fake(500))).status,
    ).toBe("manual_review");
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
  it("excludes sensitive GitLab code-search matches", async () => {
    const f = fake(200, [
      { path: ".env", data: "PRIVATE=abc" },
      { path: "src/email.ts", data: "const mailer = brevo" },
    ]);
    const result = await new GitLab("t", ["g/p"], "https://gitlab.com", f).run(
      "search_gitlab_repository",
      { project: "g/p", query: "brevo", page: 1 },
    );
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(JSON.stringify(result)).toContain("src/email.ts");
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
