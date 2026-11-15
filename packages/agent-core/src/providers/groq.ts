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
export function groq(
  apiKey: string,
  model: string,
  fetcher: typeof fetch = fetch,
): Complete {
  if (!apiKey || !model) throw new ServiceError("Groq is not configured");
  return async (messages, tools, signal) => {
    const res = await fetcher(
      "https://api.groq.com/openai/v1/chat/completions",
      {
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
      },
    );
    if (!res.ok)
      throw new ServiceError(
        `Groq request failed (${res.status})`,
        res.status === 429 || res.status >= 500,
        res.status,
      );
    const parsed = completion.safeParse(await res.json());
    if (!parsed.success)
      throw new ServiceError("Invalid Groq tool-call response");
    const msg = parsed.data.choices[0].message;
    return { ...msg, content: msg.content ?? null };
  };
}
