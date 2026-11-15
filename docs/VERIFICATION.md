# Verification record

Local verification is distinct from remote delivery. This file records source checks; it must not be presented as evidence that your Meta app receives real messages.

- **40 passing automated mocked tests**: webhook GET verification, raw HMAC, invalid/missing signatures, durable-acceptance failure, supported/unsupported events, sender/activation/global rules, mixed language, Groq parsing, connector errors/rate limits, allowlists, read-only registry, argument validation, bounded search, redaction, contact-isolated memory, tool limits, retry delays, outgoing IDs, rate-limit retry, permanent failures and ambiguous sends.
- **Passed**: strict Next.js TypeScript check and ESLint.
- **Passed**: Deno checks for all three Edge Function entry points and their runtime-portable core dependencies.
- **Passed**: Next.js production build with the supported webpack compiler (the default build script). A clean Turbopack rebuild hit an environment-specific CSS subprocess port-permission error; webpack compiled and packaged successfully. Local HTTP checks returned 200 for setup/login and 307 redirects to login for unauthenticated dashboard/contacts. Response security headers were present.
- **Passed**: production dependency audit, zero known vulnerabilities at verification time.
- `tests/database.sql` supplies transactional assertions for actual pgmq acceptance, duplicate WhatsApp IDs, global consumer concurrency, outbox uniqueness, retries, ordinary-message exclusion, disabled AI, and internal privileges.

Database integration assertions require an isolated running Supabase database and have not been executed in this workspace. No Docker runtime/running PostgreSQL instance was available. No live Groq/GitHub/GitLab/Meta calls have been claimed or recorded as successful. Browser visual QA is unavailable in this session because the required browser execution tool is not exposed; local HTTP/build checks do not substitute for visual verification of authenticated pages.

Before live use, run the isolated SQL assertions and complete the actual signed-in dashboard and incoming WhatsApp acceptance gates in `DEPLOYMENT.md`. Test a real repository question, inspect the successful tool API call, and compare the received WhatsApp answer against the referenced source.

The Tailwind UI refactor also passed TypeScript, ESLint, all 40 existing agent tests and the production build. Local HTTP checks returned 200 for login/setup and 307 to login for the protected overview. Self-hosted font files were included in the build, and a local Manrope preload was present in the response headers. Signed-in form interactions and visual responsive checks still require a browser runtime.
