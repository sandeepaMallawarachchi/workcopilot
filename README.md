# WorkCopilot — Beyond Answers. Into Action.

A single-owner, read-only WhatsApp AI assistant implemented with Next.js App Router, Supabase Auth/PostgreSQL/Edge Functions/Queues/Cron, Groq tool calling, and real GitHub/GitLab REST connectors. English, Sinhala, Singlish and mixed-language requests share the same tool and authorization boundaries.

## Run locally

```sh
npm ci
cp .env.example .env.local
# Set values in your local secret manager/environment, then:
npm run dev
```

Open http://localhost:3000. Without Supabase public configuration the application shows a setup page. The dashboard requires a provisioned Supabase administrator; there is no fake login, sample connection status, or synthetic activity.

```sh
npm run typecheck
npm test
npm run lint
npm run check:edge
npm run build
```

See [the deployment guide](docs/DEPLOYMENT.md) for exact provisioning, secret configuration, Vercel/Supabase deployment and Meta inbound verification steps. See [the operating and security notes](docs/OPERATIONS.md) for retry, outbox and recovery behavior and [verification status](docs/VERIFICATION.md) for checks performed and checks requiring external configuration.

## Structure

- `src/app`: authenticated, server-rendered admin pages and validated server actions.
- `src/lib`: Supabase session clients and server-only authorization.
- `packages/agent-core`: runtime-portable Groq orchestration, validated read-only tool registry, connectors, context and sanitization. Uses Fetch and Web Crypto, without Node-specific imports or queue dependencies.
- `supabase/functions`: public signed inbound webhook, authenticated queue consumer and authenticated outbox delivery entry point.
- `supabase/migrations`: tables, RLS, transactional acceptance/queue operations, leases, outbox, dead letters, prompt dispatch and scheduled recovery.
- `tests`: mocked API tests and transactional SQL integration assertions.

## Data flow

Signed Meta event → allowlisted contact + activation + rate limit → atomic message/job/pgmq transaction → pg_net dispatch (Cron recovery) → leased Edge consumer → Groq + allowlisted read tools → generation checkpoint/outbox → Meta test-number reply → delivery and audit records.

AI starts disabled. Ordinary messages are discarded before persistence and never become context. Integration credentials are environment secrets; browser settings store only metadata and repository selections. No Redis, dedicated Node worker, unofficial WhatsApp automation, autonomous repository writes, emails or deployment tools are present.

The source is prepared for deployment. Live Meta/Groq/provider success is **not claimed** until the external setup and end-to-end acceptance checklist have been completed.

Interface components, font licensing, theme tokens and formatting conventions are documented in [UI guidelines](docs/UI_GUIDELINES.md).
