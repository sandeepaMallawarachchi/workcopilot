import {
  db,
  env,
  required,
  internal,
  check,
  secrets,
} from "../_shared/runtime.ts";
import { deliver } from "../_shared/deliver.ts";
import { groq } from "../../../packages/agent-core/src/providers/groq.ts";
import { GitHub } from "../../../packages/agent-core/src/tools/github.ts";
import { GitLab } from "../../../packages/agent-core/src/tools/gitlab.ts";
import { Registry } from "../../../packages/agent-core/src/tools/registry.ts";
import { runAgent } from "../../../packages/agent-core/src/services/agent.ts";
import {
  contextFor,
  type HistoryMessage,
} from "../../../packages/agent-core/src/services/conversation.ts";
import { splitReply } from "../../../packages/agent-core/src/services/response.ts";
import { redact } from "../../../packages/agent-core/src/security/sanitization.ts";
import { githubToken } from "../../../packages/agent-core/src/services/credentials.ts";
Deno.serve(async (req) => {
  if (!internal(req)) return new Response("Unauthorized", { status: 401 });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const client = db();
  let job;
  try {
    job = check(await client.rpc("claim_job"));
  } catch {
    return new Response("Queue unavailable", { status: 503 });
  }
  if (!job) return Response.json({ status: "idle" });
  const deadline = AbortSignal.timeout(110000);
  let status = "retry",
    error: string | null = null;
  try {
    const settings = check(
      await client
        .from("agent_settings")
        .select("*")
        .eq("workspace_id", job.workspace_id)
        .single(),
    );
    const message = check(
      await client
        .from("messages")
        .select("*")
        .eq("id", job.message_id)
        .single(),
    );
    const conv = check(
      await client
        .from("conversations")
        .select("*")
        .eq("id", message.conversation_id)
        .single(),
    );
    const contact = check(
      await client
        .from("contacts")
        .select("*")
        .eq("id", conv.contact_id)
        .single(),
    );
    if (!settings.ai_enabled || !contact.active || !contact.ai_access)
      throw new Error("Authorization revoked");
    if (
      Date.now() - Date.parse(message.whatsapp_sent_at ?? message.created_at) >
      23 * 3600000
    ) {
      status = "dead";
      throw new Error("Reply service window expired");
    }
    const outbox = check(
      await client
        .from("delivery_outbox")
        .select("id")
        .eq("job_id", job.id)
        .limit(1),
    );
    if (!outbox?.length) {
      const integrations =
        check(
          await client
            .from("integrations")
            .select("*")
            .eq("workspace_id", job.workspace_id)
            .eq("status", "connected"),
        ) ?? [];
      const gh = integrations.find((x) => x.provider === "github"),
        gl = integrations.find((x) => x.provider === "gitlab");
      const token = gh ? await githubToken(env) : undefined;
      const known = [...secrets(), ...(token ? [token] : [])];
      const registry = new Registry(
        gh ? new GitHub(token!, gh.allowed_repositories) : undefined,
        gl
          ? new GitLab(
              required("GITLAB_TOKEN"),
              gl.allowed_repositories,
              env("GITLAB_BASE_URL"),
            )
          : undefined,
        known,
      );
      const after = new Date(
        Math.max(
          Date.parse(conv.reset_at),
          Date.now() - settings.context_hours * 3600000,
        ),
      ).toISOString();
      const history = check(
        await client
          .from("messages")
          .select("role,content,conversation_id,created_at")
          .eq("conversation_id", message.conversation_id)
          .gte("created_at", after)
          .lt("created_at", message.created_at)
          .order("created_at", { ascending: false })
          .limit(settings.context_messages),
      );
      const result = await runAgent({
        complete: groq(
          required("GROQ_API_KEY"),
          settings.groq_model || required("GROQ_MODEL"),
        ),
        registry,
        history: contextFor(
          (history ?? []).reverse() as HistoryMessage[],
          message.conversation_id,
          after,
          settings.context_messages,
        ),
        request: message.content,
        maxTools: settings.max_tool_calls,
        language: contact.preferred_language ?? settings.language_behavior,
        maxLength: settings.response_length,
        signal: deadline,
        secrets: known,
        async onTool(e) {
          check(
            await client
              .from("tool_executions")
              .insert({ ...e, job_id: job.id, workspace_id: job.workspace_id }),
          );
        },
      });
      check(
        await client.rpc("save_reply", {
          p_job: job.id,
          p_token: job.lease_token,
          p_reply: result.reply,
          p_sources: result.sources,
          p_parts: splitReply(result.reply),
        }),
      );
    }
    const sent = await deliver(job.id, job.lease_token);
    status = sent === "pending" ? "retry" : sent === "failed" ? "dead" : sent;
  } catch (e) {
    error = redact(
      e instanceof Error ? e.message : "Processing failed",
      secrets(),
    ).slice(0, 300);
  }
  try {
    check(
      await client.rpc("finish_job", {
        p_job: job.id,
        p_token: job.lease_token,
        p_status: status,
        p_error: error,
      }),
    );
  } catch {
    return new Response(
      "Lease expired; scheduled recovery will inspect the job",
      { status: 503 },
    );
  }
  // Dispatch next job after releasing the global lease; cron still guarantees recovery.
  await client.rpc("kick_worker");
  return Response.json({ status });
});
