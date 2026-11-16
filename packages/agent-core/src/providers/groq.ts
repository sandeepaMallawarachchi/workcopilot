import { z } from "zod";
import { ServiceError } from "../services/policies.ts";
import type { Complete } from "./types.ts";
const completion = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal("function"),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .max(10)
            .optional(),
        }),
      }),
    )
    .min(1),
});
async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { error?: { code?: unknown } };
    const code = body.error?.code;
    return typeof code === "string" && /^[\w.-]{1,64}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}
export function groq(
  apiKey: string,
  model: string,
  fetcher: typeof fetch = fetch,
): Complete {
  if (!apiKey || !model) throw new ServiceError("Groq is not configured");
  const request = (
    messages: Parameters<Complete>[0],
    tools: Parameters<Complete>[1],
    signal?: AbortSignal,
  ) =>
    fetcher("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? "auto" : undefined,
        temperature: 0.15,
        max_completion_tokens: 1600,
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
        : AbortSignal.timeout(25000),
    });
  return async (messages, tools, signal) => {
    let res = await request(messages, tools, signal);
    let code = res.ok ? undefined : await errorCode(res);
    if (code === "tool_use_failed") {
      // Some models (e.g. gpt-oss) emit calls to tools that were never offered,
      // such as built-in "repo_browser.*". Retry once with an explicit reminder.
      const names = tools.map((t) => t.function.name);
      res = await request(
        [
          ...messages,
          {
            role: "system",
            content: names.length
              ? `Your previous output called a tool that does not exist. Only these tools exist: ${names.join(", ")}. Otherwise answer in plain text.`
              : "No tools are available. Answer in plain text only; do not call any tool.",
          },
        ],
        tools,
        signal,
      );
      code = res.ok ? undefined : await errorCode(res);
    }
    if (!res.ok)
      throw new ServiceError(
        `Groq request failed (${res.status}${code ? ` ${code}` : ""})`,
        res.status === 429 || res.status >= 500,
        res.status,
      );
    const parsed = completion.safeParse(await res.json());
    if (!parsed.success) throw new ServiceError("Invalid Groq tool-call response");
    const msg = parsed.data.choices[0].message;
    return { ...msg, content: msg.content ?? null };
  };
}
