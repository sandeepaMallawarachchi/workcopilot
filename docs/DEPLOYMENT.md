# Deployment and configuration

This project uses the existing Meta app **WA Personal AI Agent** and its **Meta-provided test number**. Do not register, migrate, delete, or modify the number attached to your WhatsApp Business mobile app. Coexistence is outside Phase 1.

## 1. Supabase project and migrations

Create a Supabase project in your dashboard, choose a region and save its database password in your password manager. Get the project reference, project URL and publishable key from Project Settings → API. A legacy anon key is supported through `NEXT_PUBLIC_SUPABASE_ANON_KEY`; prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The service-role key is always server-only.

Install Docker and start it if using the local Supabase stack. Install the Supabase CLI using its supported Homebrew distribution:

```sh
brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations enable `pgmq`, `pg_net`, and `pg_cron`, create `ai_messages` and `ai_dead_letters`, set up RLS and create recovery/retention schedules. Supabase Vault is supplied by the hosted platform. If an extension is unavailable, enable it under Database → Extensions and rerun the migration; do not substitute an in-memory queue.

For isolated local development:

```sh
supabase start
supabase db reset
# The local project URL/key are printed by this command:
supabase status
```

Run SQL integration tests against that disposable development database, never an existing live database with active jobs:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
```

The test transaction rolls back. Existing queue contents would make its deterministic lease assertions unsuitable, so use a freshly reset test database.

### SQL Editor alternative for a fresh hosted project

If `public.profiles` does not exist and you have not applied the migrations, you can use the generated `supabase/setup.sql` instead of installing the CLI. Open your intended project in Supabase → SQL Editor → New query, paste the **entire** file, and run it once. It combines all application migrations in one transaction and deliberately refuses to run over an existing application schema. It does not create a login account or set a password.

Regenerate the bundle after changing migration sources:

```sh
npm run db:bundle
```

Verify that setup succeeded:

```sql
select to_regclass('public.profiles') as profiles_table;
```

The result must be `profiles`, rather than NULL. You can then provision the administrator below. Confirm that the SQL Editor project is the same project used by your application's Supabase URL.

Choose **either** the bundle or `supabase db push` for initial provisioning. The SQL Editor does not automatically record Supabase CLI migration history. If moving to the CLI after a **successfully committed full bundle**, first compare the remote schema with these files and record the four already-applied versions before pushing future migrations:

```sh
supabase migration repair 202611150001 202611150002 202611150003 202611150004 --status applied --linked
supabase migration list --linked
```

Do not repair versions whose SQL failed or did not run. If the setup query fails, its transaction rolls back; fix the reported error before attempting the full bundle again.

## 2. Administrator authentication

In Supabase Authentication → Providers, enable Email/password and disable public signups. In Authentication → Users, create your administrator with a strong password and mark their email confirmed. There is deliberately no automatic profile creation or browser enrollment endpoint.

In the SQL Editor, provision that exact Auth user, replacing the UUID and email below:

```sql
insert into public.profiles(id,workspace_id,email)
values ('YOUR_AUTH_USER_UUID','00000000-0000-0000-0000-000000000001','YOUR_ADMIN_EMAIL');
```

`ADMIN_EMAIL` documents your intended administrator; it does not grant access. The profile row is the authorization source. A newly signed-up user without that row cannot access any workspace data. Set Auth Site URL to your eventual Vercel URL; for development use `http://localhost:3000`. No OAuth callback is needed for the implemented password sign-in flow. Configure Supabase Auth rate limits for your environment.

### Diagnose sign-in without exposing passwords

```sh
npm run auth:check
```

This read-only local command uses your server key to check the configured administrator email, a possible `gmail.com`/`gmil.com` spelling mismatch, email confirmation and the profile associated with the Auth user ID. It never prints keys, sessions or passwords and does not modify users. Run it only in a trusted terminal. A missing Auth user or incorrect password produces an authentication failure; a missing profile is a separate administrator authorization failure. `ADMIN_EMAIL` does not create an account or override its Auth email.

Use the exact email under Supabase Authentication → Users. If an email was created with a typo, correct the Auth account through Supabase and update the corresponding profile email and local `ADMIN_EMAIL`; changing `.env` alone does not change the registered account. The dashboard password is the password set for that Auth user, not the project database or Supabase website password.

The login form provides a keyboard-accessible show/hide password button. Authentication feedback distinguishes rejected credentials, an unconfirmed email, rate limiting and service unavailability without displaying upstream errors. Fast Refresh and unused-preload warnings do not indicate rejected credentials.

## 3. Secrets and client-safe configuration

Copy `.env.example` to ignored `.env.local` for Next.js development. Set only the following as browser-safe variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon fallback)
- `NEXT_PUBLIC_APP_URL`

All other values are server secrets. The Next.js server needs its Supabase service-role key and GitHub/GitLab credentials to verify integration connections. Edge Functions need their own copies of provider/Meta/Groq/internal secrets. Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions; do not attempt to overwrite reserved `SUPABASE_*` secrets through the CLI.

Create a separate ignored Edge secret file, for example `.env.edge`, using your secret manager. Do not put secret values in committed SQL, source files, screenshots, issues, logs, or chat messages. Include these keys:

```text
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_GRAPH_API_VERSION
WHATSAPP_TEST_RECIPIENTS
GROQ_API_KEY
GROQ_MODEL
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_INSTALLATION_ID
GITHUB_TOKEN
ALLOW_DEV_GITHUB_TOKEN
GITLAB_TOKEN
GITLAB_BASE_URL
INTERNAL_JOB_SECRET
```

Choose an unpredictable verification token. Generate an internal secret with at least 32 characters, for example `openssl rand -hex 32`, and store it directly in your secret manager. `WHATSAPP_TEST_RECIPIENTS` is a comma-separated list of international numbers, each actually verified under Meta's test-number recipient setup. The database allowlist alone does not grant test-number sending permission.

Set `WHATSAPP_PHONE_NUMBER_ID` to the **test phone number ID**, not its visible phone number and not your existing business number. Set the WABA ID belonging to that test number. Set `WHATSAPP_GRAPH_API_VERSION` to the active Graph API version shown in your Meta dashboard, in `vNN.0` format. It is intentionally not hardcoded. Temporary Meta dashboard access tokens expire; replace them with an appropriate supported token for sustained testing.

```sh
supabase secrets set --env-file .env.edge
```

Groq: create an API key in Groq Cloud, inspect the currently available tool-calling models in your console, and set `GROQ_MODEL` to one of those identifiers with at least 65,536 tokens of context (the agent enforces a conservative 48,000-token input/completion budget). Verify availability with Groq's Models endpoint from a trusted terminal if needed. The dashboard model field overrides the environment model only when non-empty. No hardcoded model fallback exists.

## 4. GitHub App (preferred)

Create a GitHub App with only repository **Contents: Read**, **Issues: Read**, **Pull requests: Read**, and **Metadata: Read**. No webhook subscription is required for this read-only connector. Install it only on repositories you intend to expose. Record App ID and Installation ID; generate a private key and store it in server secrets.

The Web Crypto signer requires PKCS#8 PEM. Convert a downloaded PKCS#1 key locally if necessary:

```sh
openssl pkcs8 -topk8 -nocrypt -in github-app.pem -out github-app-pkcs8.pem
```

Store the resulting key with your secret manager; never commit either file. Multiline PEM or literal `\n` line separators are accepted. Short-lived installation tokens are minted on demand, never saved to the database or browser. The token creation POST is an authentication operation; repository tool calls are exclusively GET.

Development fallback: use a fine-grained token restricted to selected repositories and those same read permissions, set `GITHUB_TOKEN`, and explicitly set `ALLOW_DEV_GITHUB_TOKEN=true`. Leave App credentials unset when using this mode. Personal tokens bind access to your personal identity and generally have a longer lifetime; use short expiry and rotate. Never enable broad classic write scopes.

Open Integrations → GitHub. Enter full `owner/repository` paths, one per line. **Verify & save selection** authenticates against GitHub and verifies each repository before saving `connected`. Empty selection allows no repository access.

Code search deliberately uses an App-compatible bounded tree/blob strategy: at most eight eligible small text files per page, up to five pages, restricted by tool-call budget. It reports which paths were searched, pagination and tree truncation. It does not claim a complete search. Secret files are excluded. Native GitHub code-search permission differences are not hidden behind fake results.

## 5. GitLab

Create a GitLab.com access token with the minimum **read_api** scope and access limited to required projects; no write scope is needed. Set `GITLAB_TOKEN` and `GITLAB_BASE_URL=https://gitlab.com` in both Next.js server and Edge secrets.

Open Integrations → GitLab, select full namespace/project paths by entering one per line, then verify/save. Project code search uses GitLab's real project search endpoint; availability depends on your account tier, indexing and token permissions. An unavailable search reports a tool error. File, commit, issue, MR and pipeline tools use their respective REST endpoints.

The base URL is configurable in the connector but Phase 1 explicitly rejects hosts other than GitLab.com to prevent credential forwarding/SSRF. Supporting self-hosted GitLab later requires an audited server-side host allowlist and network policy, not a browser-editable arbitrary URL.

## 6. Deploy Edge Functions

```sh
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy process-ai-message --no-verify-jwt
supabase functions deploy send-whatsapp-message --no-verify-jwt
```

The inbound webhook must be public to Meta and validates `X-Hub-Signature-256` on every POST. Both internal functions also bypass the Supabase gateway JWT check because they use **mandatory `X-Internal-Secret` authentication**, compared with the server-side secret before any database or provider operation. Public access without this header returns 401. Do not remove this application-level check.

## 7. Prompt dispatch and Cron fallback

In Supabase SQL Editor, store two secrets in **Vault** using the Vault UI:

- Name `project_url`: `https://YOUR_PROJECT_REF.supabase.co`
- Name `internal_job_secret`: the same value as `INTERNAL_JOB_SECRET` in Edge secrets

Use Vault's secret editor rather than putting actual values in tracked SQL. These are not exposed by RLS or browser queries. The transactional job insert trigger dispatches through `pg_net` after commit. Cron calls the same function every minute as durable fallback; no `waitUntil()` dependency exists.

Inspect schedules and dispatch:

```sql
select jobname,schedule,active from cron.job where jobname like 'workcopilot%';
select status,attempts,error,created_at from public.agent_jobs order by created_at desc limit 20;
select * from pgmq.metrics('ai_messages');
select * from pgmq.metrics('ai_dead_letters');
select public.kick_worker();
```

If secret rotation is needed, update both Edge secrets and the Vault copy. Inspect pg_net request metadata carefully; avoid exporting request headers because they contain the internal secret.

## 8. Vercel frontend

Import this repository in Vercel, select Next.js, use Node.js 24, and keep the default build command `npm run build`. Configure the three public variables, `SUPABASE_SERVICE_ROLE_KEY`, and GitHub/GitLab server credentials under Project → Settings → Environment Variables. No Meta/Groq secrets are required by the frontend server. Redeploy after changing server variables.

Alternatively:

```sh
npx vercel
npx vercel --prod
```

Set Supabase Auth Site URL to that deployment and `NEXT_PUBLIC_APP_URL` to the same origin. Sign in with your provisioned administrator. Confirm that ordinary unauthenticated visits cannot access dashboard data.

## 9. Meta webhook registration and inbound verification

In **WA Personal AI Agent** → WhatsApp → Configuration (labels can vary by Meta console version):

1. Set callback URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`.
2. Enter the exact `WHATSAPP_VERIFY_TOKEN` stored in Edge secrets and verify/save.
3. Subscribe to the **messages** webhook field for `whatsapp_business_account`.
4. Confirm the app is subscribed to the test WABA. Inspect the WABA `subscribed_apps` endpoint with appropriate permissions; if the console has not subscribed it, use Meta's documented subscription setup. Do not change an unrelated production WABA.
5. In WhatsApp API Setup/API Testing, select the existing Meta test number. Add and verify your personal recipient there.
6. In WorkCopilot Contacts, add that same international number, enable Active and AI access. Also add it to `WHATSAPP_TEST_RECIPIENTS` in Edge secrets.
7. Verify the repository/project connection and allowlist in Integrations.
8. In Settings, confirm the tool-calling Groq model, then enable AI.
9. From the authorized personal WhatsApp account, send the Meta test number an actual message: `@ai machan owner/repository repo eke latest commit eka check karanna`.
10. Inspect the webhook function's **invocation** in Supabase, then a new `messages` user row and `agent_jobs` row. A previous successful outbound template or Meta's synthetic webhook test does **not** prove actual inbound delivery.
11. Inspect the processor invocation, successful `tool_executions`, persisted assistant reply, `delivery_outbox.status=sent`, and its Meta outgoing message ID.
12. Confirm the reply arrives on the actual recipient and accurately cites API evidence. Ask a follow-up such as `@ai eka kawadda push kale?` and check the tool fetched the referenced commit.
13. Send an ordinary message and a message from an unknown number. Neither should create stored conversation content or a Groq invocation. Test the global pause switch.

A signed Meta dashboard sample is useful for signature/payload diagnosis but is not an end-to-end test. Its sample sender or phone/WABA IDs may not match your authorized configuration and will correctly be ignored.

Meta app mode, test recipients, permissions and account eligibility can restrict real inbound delivery. If only dashboard test events arrive, record that exact limitation: first check callback field subscription, app/WABA subscription, test-number IDs, verified recipient and function invocation logs. Follow the mode/eligibility requirements currently shown in your app's WhatsApp setup; if Meta requires Live mode, complete its supported app requirements before switching mode. Do not assert that development mode always supports or always blocks real inbound traffic. Keep the test number and do not migrate your mobile app number. Never replace the official integration with WhatsApp Web automation.

## 10. Acceptance gates before calling it live

- Migrations and transactional SQL tests run successfully on an isolated Supabase database.
- Auth signup disabled and only intended profile provisioned; RLS and internal-function denials verified.
- Actual incoming personal message produces a signed webhook invocation and one durable job.
- Duplicate delivery of that inbound event does not create another job or response.
- A real GitHub/GitLab read succeeds, Groq uses its result, and WhatsApp receives the response.
- Ordinary, unknown, revoked and globally paused requests do not process.
- Retry/dead-letter and ambiguous-delivery review are understood by the owner.

## Reference documentation

- [Supabase Queues / pgmq](https://supabase.com/docs/guides/queues/pgmq)
- [Scheduling Edge Functions with Cron, pg_net and Vault](https://supabase.com/docs/guides/functions/schedule-functions)
- [Edge Function dependency/import-map configuration](https://supabase.com/docs/guides/functions/dependencies)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- [Groq tool use](https://console.groq.com/docs/tool-use/overview)
- [GitHub REST search authentication and limits](https://docs.github.com/en/rest/search/search)
- [GitLab Search API](https://docs.gitlab.com/api/search/)
- [Official WhatsApp webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/)
