import { db, env, required, internal, check, secrets } from "../_shared/runtime.ts";
import { deliver } from "../_shared/deliver.ts";
import {
  sendTypingIndicator,
  sendWhatsApp,
} from "../../../packages/agent-core/src/services/delivery.ts";
import { failureNotice } from "../../../packages/agent-core/src/services/errors.ts";
import { ServiceError } from "../../../packages/agent-core/src/services/policies.ts";
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
import { EmailTools } from "../../../packages/agent-core/src/tools/email.ts";
import { findVerification } from "../../../packages/agent-core/src/email/mailbox.ts";
import {
  asksForVerificationCode,
  stronglyAsksForVerificationCode,
  verificationMessages,
} from "../../../packages/agent-core/src/email/verification.ts";
import { denoImapConnect } from "../_shared/imap-transport.ts";
import { loadMailboxes } from "../_shared/mailboxes.ts";
import { runAgent } from "../../../packages/agent-core/src/services/agent.ts";
import {
  contextFor,
  type HistoryMessage,
} from "../../../packages/agent-core/src/services/conversation.ts";
import { splitReply } from "../../../packages/agent-core/src/services/response.ts";
import {
  combineScopes,
  deniedProviders,
  intersect,
  noAccessText,
  scopeFromTasks,
  isHelpRequest,
  scopeFor,
  storedShortcuts,
  welcomeText,
} from "../../../packages/agent-core/src/services/shortcuts.ts";
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
      // Shortcut scope (e.g. "@github"): only the chosen tools are loaded and
      // offered to the model, which saves tokens and keeps answers on topic.
      const shortcuts = storedShortcuts(settings.shortcuts);
      // Per-contact access (null = all integrations) ∩ shortcut scope.
      const access: string[] | null = contact.allowed_tasks ?? null;
      const shortcutScope = scopeFor(message.shortcut, shortcuts);
      const scope = combineScopes(shortcutScope, scopeFromTasks(access));
      // One-time welcome listing the prefixes, sent before a new contact's first
      // reply. Kept out of history (p_reply) so it never costs tokens later.
      const welcome =
        contact.welcomed_at === null
          ? welcomeText({
              name: contact.display_name,
              mainPrefix: settings.activation_prefix,
              shortcuts,
              followupMinutes: settings.followup_minutes ?? 10,
              first: true,
              access,
            })
          : null;
      // Contacts allowed to view secrets get unmasked values (owner opt-in).
      const allowSecrets = contact.can_view_secrets === true;
      const reply = async (
        stored: string,
        sent: string | null,
        sources: string[] = [],
      ) => {
        check(
          await client.rpc("save_reply", {
            p_job: job.id,
            p_token: job.lease_token,
            p_reply: stored,
            p_sources: sources,
            p_parts: [
              ...(welcome ? [welcome] : []),
              ...(sent ? splitReply(sent, undefined, !allowSecrets) : []),
            ],
          }),
        );
        if (welcome)
          check(
            await client
              .from("contacts")
              .update({ welcomed_at: new Date().toISOString() })
              .eq("id", contact.id),
          );
      };
      const mailboxes = scope.email ? await loadMailboxes(client, job.workspace_id) : [];
      let handled = false;
      // No access: answer clearly without the AI instead of a confusing reply.
      // 1) A shortcut whose services this contact cannot use at all.
      const usedShortcut = message.shortcut
        ? shortcuts.find((x) => x.prefix.toLowerCase() === message.shortcut.toLowerCase())
        : undefined;
      if (
        usedShortcut &&
        scope.github === null &&
        scope.gitlab === null &&
        !scope.email
      ) {
        const providers = [
          ...new Set(
            usedShortcut.tasks.map(
              (t) => t.split(":")[0] as "github" | "gitlab" | "email",
            ),
          ),
        ];
        const text = noAccessText(providers, usedShortcut.prefix);
        await reply(text, text);
        handled = true;
      }
      // 2) A request that names a service the contact has no access to.
      const denied = handled
        ? []
        : deniedProviders(message.content, scopeFromTasks(access));
      if (!handled && denied.length && !isHelpRequest(message.content)) {
        const text = noAccessText(denied);
        await reply(text, text);
        handled = true;
      }
      // "@ai help" / "menu": the shortcut list, no AI needed.
      if (!handled && isHelpRequest(message.content)) {
        await reply(
          "📋 Sent the list of shortcuts.",
          welcome
            ? null
            : welcomeText({
                mainPrefix: settings.activation_prefix,
                shortcuts,
                followupMinutes: settings.followup_minutes ?? 10,
                first: false,
                access,
              }),
        );
        handled = true;
      }
      // Opt-in verification codes: answered WITHOUT the AI, only from approved
      // senders, only recent emails. The code is sent but never stored in
      // history (which is later resent to the AI).
      if (
        !handled &&
        settings.verification_codes_enabled &&
        scope.codes &&
        (settings.verification_senders ?? []).length &&
        mailboxes.length &&
        asksForVerificationCode(message.content)
      ) {
        const {
          match: found,
          unreachable,
          unapproved,
        } = await findVerification(
          denoImapConnect,
          mailboxes,
          settings.verification_senders,
          message.content,
        );
        if (found || stronglyAsksForVerificationCode(message.content)) {
          const texts = found
            ? verificationMessages(found)
            : {
                sent:
                  unreachable.length === mailboxes.length
                    ? `🔐 I couldn't check your mailbox (${unreachable.join(", ")}). Use "Test" under Integrations → Email to see why.`
                    : unapproved.length
                      ? `🔐 Found a recent sign-in email from ${unapproved.join(", ")}, but that sender isn't approved. Add it under Integrations → Email → Approved senders, then ask again.`
                      : `🔐 No sign-in email from your approved senders arrived in the last 15 minutes${unreachable.length ? ` (couldn't check: ${unreachable.join(", ")})` : ""}. Request a new code, then ask again.`,
                stored: "🔐 No recent sign-in email from approved senders was found.",
              };
          await reply(texts.stored, texts.sent);
          handled = true;
        }
      }
      if (!handled) {
        const integrations =
          check(
            await client
              .from("integrations")
              .select("*")
              .eq("workspace_id", job.workspace_id)
              .eq("status", "connected"),
          ) ?? [];
        // A shortcut that excludes a provider skips it entirely (no token, no lookups).
        const gh =
            scope.github === null
              ? undefined
              : integrations.find((x) => x.provider === "github"),
          gl =
            scope.gitlab === null
              ? undefined
              : integrations.find((x) => x.provider === "gitlab");
        const token = gh ? await githubToken(env) : undefined;
        const known = allowSecrets ? [] : [...secrets(), ...(token ? [token] : [])];
        const registry = new Registry(
          gh
            ? new GitHub(
                token!,
                await resolveGitHubRepositories(
                  gh.allowed_repositories,
                  token!,
                  deadline,
                ),
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
          {
            github: intersect(gh?.capabilities ?? undefined, scope.github),
            gitlab: intersect(gl?.capabilities ?? undefined, scope.gitlab),
          },
          mailboxes.length
            ? new EmailTools(
                mailboxes,
                denoImapConnect,
                settings.email_blocked_senders ?? [],
              )
            : undefined,
        );
        registry.unmasked = allowSecrets;
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
          allowSecrets,
          async onTool(e) {
            typing();
            check(
              await client
                .from("tool_executions")
                .insert({ ...e, job_id: job.id, workspace_id: job.workspace_id }),
            );
          },
        });
        await reply(result.reply, result.reply, result.sources);
      }
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
