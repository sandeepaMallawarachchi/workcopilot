# First real WhatsApp request

A running local Next.js dashboard does not expose the Supabase Edge Functions to Meta. Setting local secrets or enabling AI does not deploy the backend.

## Inspect before retrying

```sh
npm run whatsapp:check
```

This read-only command inspects settings, contact authorization, message/job counts, integration selection and the three deployed endpoint responses. It does not send WhatsApp messages, create test jobs, claim queue entries or print message bodies/secrets. Run it from a trusted local terminal.

An unsigned GET should return 403 for the public webhook and 401 for the two internal functions. These responses establish that routes/authentication guards exist; they do not establish that Meta delivers real inbound events. A 404 means the expected route is not deployed at that URL. The code must be deployed before callback verification can succeed.

## Deploy to the intended project

Prepare an ignored, owner-readable Edge secret file from the existing local environment:

```sh
npm run secrets:prepare
```

The preparation command excludes Supabase's reserved built-in keys and all browser variables, supports quoted multiline keys, and never overwrites an existing `.env.edge`. If local credentials change after generating it, update that local file before uploading.

Sign in to the Supabase CLI from your terminal, then target the same project as `NEXT_PUBLIC_SUPABASE_URL`:

```sh
npx supabase login
npx supabase secrets set --env-file .env.edge --remote=YOUR_PROJECT_REF
npx supabase functions deploy whatsapp-webhook process-ai-message send-whatsapp-message --remote=YOUR_PROJECT_REF --no-verify-jwt --use-api
```

`--use-api` bundles on Supabase without requiring Docker. Internal functions still require the server-only internal-secret header. Use your Supabase account/CLI credentials for deployment, not the database service-role key.

## Connect delivery and authorization

1. In Meta's WhatsApp use-case Configuration, set the callback URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`. Verify with the value of `WHATSAPP_VERIFY_TOKEN` uploaded to Edge secrets, and subscribe to `messages`.
2. Confirm that the app is subscribed to the test WABA and that all test-number IDs match. A successful outbound template is not evidence that inbound webhook delivery works.
3. In Supabase Vault, add `project_url` (the project's base HTTPS URL) and `internal_job_secret` (the same value as the uploaded `INTERNAL_JOB_SECRET`). This enables prompt dispatch and Cron recovery. Never paste these secrets into tracked SQL.
4. In Contacts, add the **sender's personal number**, including country code, and enable Active and AI access. The Meta test business number is the destination, not the contact to authorize. While using Meta's test number, the number must also be verified under API Setup "To" (a Meta restriction).
5. Keep AI enabled. Send a **new** message, `@ai hello`. Ignored older messages are not replayed automatically.
6. Inspect a real webhook invocation, a stored activated user message, a processing job, and an accepted outgoing message ID. Compare these with the reply received on WhatsApp.
7. For repository questions, verify/save GitHub or GitLab in Integrations and select authorized repository/project paths. Environment credentials alone do not mark an integration connected.

Requests to disclose `.env` contents or credentials are outside the assistant's permitted behavior. Use a greeting for connectivity and a README summary for a repository test.

For errors, follow the full [deployment guide](DEPLOYMENT.md), including Meta app-mode restrictions and actual incoming-event acceptance gates. Do not change the existing WhatsApp Business mobile-app number or use unofficial WhatsApp Web automation.
