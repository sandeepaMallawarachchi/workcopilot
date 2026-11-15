import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Read-only diagnostics: never print keys, sessions, tokens, passwords, or raw errors.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configuredEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
if (!url || !key || !configuredEmail) {
  console.log(
    JSON.stringify({ error: "Missing Supabase URL, server key, or ADMIN_EMAIL." }),
  );
  process.exitCode = 1;
} else {
  const candidates = new Set([
    configuredEmail,
    configuredEmail.replace(/@gmil\.com$/, "@gmail.com"),
    configuredEmail.replace(/@gmail\.com$/, "@gmil.com"),
  ]);
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  const matches = [];
  let scanComplete = false;
  let failure;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      failure = {
        status: error.status ?? null,
        code: error.code ?? "auth_admin_request_failed",
      };
      break;
    }
    matches.push(
      ...data.users.filter((user) => candidates.has((user.email ?? "").toLowerCase())),
    );
    if (data.users.length < 100) {
      scanComplete = true;
      break;
    }
  }
  const report = {
    configuredEmail,
    projectHostname: new URL(url).hostname,
    scanComplete,
    failure,
    accounts: [],
  };
  if (!failure) {
    for (const user of matches) {
      const { data: profile, error } = await db
        .from("profiles")
        .select("id,email,workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      report.accounts.push({
        email: user.email,
        emailConfirmed: Boolean(user.email_confirmed_at),
        lastSignInAt: user.last_sign_in_at ?? null,
        adminProfileExists: Boolean(profile),
        profileEmailMatchesAuth: profile ? profile.email === user.email : null,
        defaultWorkspace: profile
          ? profile.workspace_id === "00000000-0000-0000-0000-000000000001"
          : null,
        profileReadError: error ? { code: error.code } : null,
      });
    }
  }
  if (
    failure ||
    !scanComplete ||
    report.accounts.length === 0 ||
    report.accounts.some(
      (account) =>
        !account.emailConfirmed ||
        !account.adminProfileExists ||
        account.profileReadError,
    )
  )
    process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
}
