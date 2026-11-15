# Operating and security notes

## Jobs and recovery

Acceptance executes in one Postgres transaction: lock the contact, authorize it, require the activation prefix, enforce five activated requests/minute, deduplicate the WhatsApp ID, persist the stripped request, create a job, and `pgmq.send`. An exception rolls the whole transaction back; the webhook returns 503 rather than falsely acknowledging durable acceptance.

The new-job database trigger uses pg_net after commit to invoke the processor. A one-minute Cron schedule supplies recovery if dispatch is lost, secrets were missing, or a function dies. Queue entries remain durable regardless of function process lifetime.

The Phase 1 consumer handles one job per invocation with a global database lease. Visibility and lease are 180 seconds; model/tool work has a 110-second signal deadline, provider requests have shorter individual timeouts, and sending is bounded to short WhatsApp parts. Concurrent invocations see the workspace lease and exit. Expired workers are fenced from saving replies, claiming deliveries or finishing jobs using a unique lease token. An abandoned processing job becomes visible again after 180 seconds.

Retries use a maximum of three processing attempts and exponential visibility backoff of 30 then 60 seconds. Exhausted jobs move to `dead` and a reference is sent to `ai_dead_letters`. Attempts and sanitized errors remain in Activity. One completion schedules the next invocation; Cron guarantees another opportunity if that dispatch fails. AI pause leaves queued work durable and stops claims/delivery authorization. A request already in flight to an external API cannot be recalled.

## Outbox and uncertain delivery

Generation and outbox rows checkpoint atomically. A worker retry reuses the outbox rather than generating a second answer. `(job_id,part)` is unique. `begin_delivery` validates the current lease, global enable and contact permission, then persists `sending` **before** making the Meta HTTP request.

- Successful Meta response with message ID → `sent`.
- Explicit HTTP 429 rejection → `pending`, safe bounded retry.
- Permanent 4xx rejection → `failed` and dead job.
- Network timeout, malformed accepted response, 5xx, or abandoned `sending` → `manual_review`.

This intentionally favors avoiding duplicate replies. There is no claim of exactly-once remote delivery: Meta accepting an HTTP request and the database recording its ID cannot share a transaction. Successful `sent` means Meta API acceptance, not proof that the recipient read or received the message. Status callbacks are ignored by the inbound message agent.

For `manual_review`, inspect the recipient's actual conversation and Meta diagnostics before taking action. Do not bulk reset outbox statuses or blindly requeue dead letters. If a reply clearly did not arrive, the owner can send a new explicitly activated request; this creates a new tracked job. Any future administrative retry control must make uncertain delivery explicit and preserve the original audit record.

Use Supabase SQL Editor with administrative privileges to inspect:

```sql
select id,status,attempts,error,lease_until from public.agent_jobs order by created_at desc limit 30;
select job_id,part,status,whatsapp_message_id,error from public.delivery_outbox order by updated_at desc limit 30;
select job_id,tool,outcome,duration_ms,summary from public.tool_executions order by created_at desc limit 30;
select * from pgmq.metrics('ai_messages');
select * from pgmq.metrics('ai_dead_letters');
```

Avoid exporting raw net request tables or secret settings. Credentials must never be put in audit details.

## Language, grounding and privacy

The LLM receives a multilingual system instruction and a bounded activated-message history from exactly one conversation. Contact-specific language preference overrides default matching; technical identifiers stay in English. Follow-up references are resolved from history, then external facts should be verified through tools. Ambiguous repository selection calls for clarification. This remains an LLM behavior, so live acceptance must evaluate answer accuracy; passing mocked tests does not certify every future answer.

History is bounded by message count, expiration and a 12,000-byte UTF-8 history budget. Before every completion, the orchestrator also checks serialized message/schema bytes plus a 2,560-token completion/framing reserve against a 48,000-token budget. Counting UTF-8 bytes conservatively bounds byte-level BPE tokens even for Sinhala; it is intentionally stricter than a typical English character/token estimate. Choose a Groq model with at least 65,536 tokens of context. Oversized investigations stop with a clear request to narrow scope. Tool result size, tool count, context count and completion tokens are independently bounded. The retention Cron deletes expired messages (cascading jobs/tool results/outbox) and audit events; conversation shells and contacts remain. Manual history deletion resets memory and removes messages/jobs/tool records/outbox. It refuses while processing jobs are active. Database backups have separate retention and must be managed in Supabase.

Only activated requests are stored. Webhook payloads, ordinary conversations and receipt bodies are not logged. Contact authorization is rechecked at processing and delivery. Server-known credentials and common token/key/password forms are redacted from tool data, model input/output and error summaries. Sensitive file paths such as `.env`, private key files and credential files are blocked. Files are bounded and sent to the model as relevant excerpts; WhatsApp instructions require summaries rather than dumping private files.

Retrieved code, issues, commit messages and tool data remain untrusted. System instructions explicitly reject embedded instructions; the backend enforces validated registered tools, fixed provider origins, exact allowlists, GET-only repository API access, and no shell/database/arbitrary HTTP capability. A model instruction alone cannot guarantee immunity to all prompt injection or identify every possible unknown secret. These backend boundaries and redaction reduce exposure; scope provider access and authorized contacts accordingly. For highly sensitive repositories, do not authorize access until your organization's disclosure policy permits sending excerpts to Groq and replies to the selected WhatsApp recipient.

GitLab.com is the only permitted GitLab origin in Phase 1. Redirects are rejected by REST clients. GitHub search reports its bounded paths and truncation; GitLab search failures are real and visible. Pagination is explicit (`page` 1–5, twenty objects or eight searched GitHub files/page). Tool errors report normalized status and rate-limit hints without upstream credential-bearing response bodies. Only registered tool schemas are provided to Groq.

## Authentication and data ownership

Supabase Auth identifies administrators. Profile rows provisioned by the owner confer workspace access; neither signup nor matching `ADMIN_EMAIL` is sufficient. Every exposed table has RLS. Browser sessions have SELECT access through `is_admin`; mutations happen only in authenticated Next.js actions after `getUser()` and profile verification. Service-role credentials are imported through a server-only module and never sent to client components.

All operational entities include `workspace_id`; contact/conversation ownership has composite constraints. Phase 1 deliberately runs one fixed workspace, one global consumer lease, and environment-held owner integration credentials. This is a future workspace boundary, not a claim of full multi-tenancy. SaaS expansion requires per-workspace encrypted credential storage, workspace-scoped dispatch/leases, tenant-aware webhook routing, invitation/role lifecycle, provider installation routing and further isolation tests.

## External configuration still required

Create/configure the Supabase project, apply and test migrations, provision the Auth user/profile, set Next.js and Edge secrets, populate Vault, deploy functions and Vercel, connect permitted GitHub/GitLab repositories, register the Meta callback/messages subscription for the test WABA, verify test recipients, enable AI and perform the documented actual inbound-to-reply test. Never change the existing WhatsApp Business mobile app number.
