import { db, env, required, internal, check, secrets } from "../_shared/runtime.ts";
import { deliver } from "../_shared/deliver.ts";
import {
  sendTypingIndicator,
  sendWhatsApp,
} from "../../../packages/agent-core/src/services/delivery.ts";
import { failureNotice } from "../../../packages/agent-core/src/services/errors.ts";
import {
  normalizePhone,
  ServiceError,
} from "../../../packages/agent-core/src/services/policies.ts";
import { groq } from "../../../packages/agent-core/src/providers/groq.ts";
import {
  GitHub,
  resolveGitHubRepositories,
} from "../../../packages/agent-core/src/tools/github.ts";
import {
  GitLab,
  resolveGitLabProjects,
} from "../../../packages/agent-core/src/tools/gitlab.ts";
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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
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
  // Who to tell if this request fails for good, and whether a notice makes sense.
  let recipient: string | null = null;
  let notify = true;
  try {
    const settings = check(
      await client
        .from("agent_settings")
        .select("*")
        .eq("workspace_id", job.workspace_id)
        .single(),
    );
    const message = check(
      await client.from("messages").select("*").eq("id", job.message_id).single(),
    );
    const conv = check(
      await client
        .from("conversations")
        .select("*")
        .eq("id", message.conversation_id)
        .single(),
    );
    const contact = check(
      await client.from("contacts").select("*").eq("id", conv.contact_id).single(),
    );
    recipient = contact.phone;
    if (!settings.ai_enabled || !contact.active || !contact.ai_access) {
      notify = false;
      throw new Error("Authorization revoked");
    }
    if (
      Date.now() - Date.parse(message.whatsapp_sent_at ?? message.created_at) >
      23 * 3600000
    ) {
      status = "dead";
      notify = false; // WhatsApp no longer allows a free-form reply
      throw new Error("Reply service window expired");
    }
    const outbox = check(
      await client.from("delivery_outbox").select("id").eq("job_id", job.id).limit(1),
    );
    if (!outbox?.length) {
      // Show "typing…" in WhatsApp while the agent works; refreshed on tool
      // activity because Meta clears it after ~25 seconds.
      let lastTyping = 0;
      const typing = () => {
        if (!message.whatsapp_message_id || Date.now() - lastTyping < 20000) return;
        lastTyping = Date.now();
        void sendTypingIndicator(
          {
            token: env("WHATSAPP_ACCESS_TOKEN") ?? "",
            phoneId: env("WHATSAPP_PHONE_NUMBER_ID") ?? "",
            version: env("WHATSAPP_GRAPH_API_VERSION") ?? "",
          },
          message.whatsapp_message_id,
        );
      };
      typing();
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
        gh
          ? new GitHub(
              token!,
              await resolveGitHubRepositories(gh.allowed_repositories, token!, deadline),
              fetch,
              gh.blocked_paths ?? [],
            )
          : undefined,
        gl
          ? new GitLab(
              required("GITLAB_TOKEN"),
              await resolveGitLabProjects(
                gl.allowed_repositories,
                required("GITLAB_TOKEN"),
                env("GITLAB_BASE_URL") || undefined,
                deadline,
              ),
              env("GITLAB_BASE_URL") || undefined,
              fetch,
              gl.blocked_paths ?? [],
            )
          : undefined,
        known,
        // Tolerates a database without the access-policy migration (all allowed).
        { github: gh?.capabilities ?? undefined, gitlab: gl?.capabilities ?? undefined },
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
          typing();
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
    if (sent === "failed") {
      notify = false; // delivery itself is broken; details are in delivery_outbox
      error = "Reply delivery failed; see delivery error";
    }
  } catch (e) {
    // Errors that cannot succeed on retry (e.g. a rejected request) fail now
    // instead of burning the remaining attempts and delaying the notice.
    if (e instanceof ServiceError && !e.retryable) status = "dead";
    error = redact(e instanceof Error ? e.message : "Processing failed", secrets()).slice(
      0,
      300,
    );
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
    return new Response("Lease expired; scheduled recovery will inspect the job", {
      status: 503,
    });
  }
  const final =
    status === "dead" || (status === "retry" && job.attempts >= job.max_attempts);
  if (final && notify && recipient && error) {
    // Best effort: tell the sender instead of leaving them waiting in silence.
    try {
      await sendWhatsApp(
        {
          token: env("WHATSAPP_ACCESS_TOKEN") ?? "",
          phoneId: env("WHATSAPP_PHONE_NUMBER_ID") ?? "",
          version: env("WHATSAPP_GRAPH_API_VERSION") ?? "",
          recipients: (env("WHATSAPP_TEST_RECIPIENTS") ?? "")
            .split(",")
            .filter(Boolean)
            .map(normalizePhone),
        },
        recipient,
        failureNotice(error),
      );
    } catch {
      // Ignore: the dashboard still shows the failure.
    }
  }
  // Dispatch next job after releasing the global lease; cron still guarantees recovery.
  await client.rpc("kick_worker");
  return Response.json({ status });
});
