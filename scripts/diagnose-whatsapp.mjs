import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Read-only diagnostics. Never send messages, invoke a worker, or print credentials/content.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server configuration is missing.");
const timedFetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: timedFetch },
});
const workspace = "00000000-0000-0000-0000-000000000001";
const report = {
  webhookUrl: `${url.replace(/\/$/, "")}/functions/v1/whatsapp-webhook`,
  localConfiguration: Object.fromEntries(
    [
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "WHATSAPP_GRAPH_API_VERSION",
      "WHATSAPP_TEST_RECIPIENTS",
      "GROQ_API_KEY",
      "GROQ_MODEL",
      "INTERNAL_JOB_SECRET",
    ].map((name) => [name, Boolean(process.env[name]?.trim())]),
  ),
};
const results = await Promise.allSettled([
  db
    .from("agent_settings")
    .select("ai_enabled,activation_prefix,groq_model")
    .eq("workspace_id", workspace)
    .single(),
  db.from("contacts").select("phone,active,ai_access").eq("workspace_id", workspace),
  db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace),
  db
    .from("agent_jobs")
    .select("status,attempts,created_at")
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false })
    .limit(10),
  db
    .from("integrations")
    .select("provider,status,allowed_repositories")
    .eq("workspace_id", workspace),
  ...["whatsapp-webhook", "process-ai-message", "send-whatsapp-message"].map(
    async (name) => {
      const response = await timedFetch(
        `${url.replace(/\/$/, "")}/functions/v1/${name}`,
        { method: "GET" },
      );
      return { name, status: response.status };
    },
  ),
]);
function result(index) {
  const value = results[index];
  if (value.status === "rejected") return { error: "Network or request failure" };
  if (value.value.error) return { errorCode: value.value.error.code || "request_failed" };
  return value.value;
}
const settings = result(0),
  contacts = result(1),
  messages = result(2),
  jobs = result(3),
  integrations = result(4);
report.settings = settings.data ?? settings;
const normalize = (number) => "+" + number.replace(/\D/g, "");
const recipients = (process.env.WHATSAPP_TEST_RECIPIENTS ?? "")
  .split(",")
  .filter((number) => number.trim())
  .map(normalize);
report.contacts = contacts.data
  ? {
      total: contacts.data.length,
      authorized: contacts.data.filter((contact) => contact.active && contact.ai_access)
        .length,
      permittedRecipientsInContactAllowlist: recipients.map((number) => ({
        lastFour: number.slice(-4),
        authorized: contacts.data.some(
          (contact) => contact.phone === number && contact.active && contact.ai_access,
        ),
      })),
    }
  : contacts;
report.storedMessageCount = messages.count ?? messages;
report.recentJobs = jobs.data ?? jobs;
report.integrations =
  integrations.data?.map((connection) => ({
    provider: connection.provider,
    status: connection.status,
    allowedRepositoryCount: connection.allowed_repositories.length,
  })) ?? integrations;
report.edgeEndpoints = results
  .slice(5)
  .map((entry, index) =>
    entry.status === "fulfilled"
      ? entry.value
      : {
          name: ["whatsapp-webhook", "process-ai-message", "send-whatsapp-message"][
            index
          ],
          error: "Endpoint unreachable",
        },
  );
console.log(JSON.stringify(report, null, 2));

const queryFailure = [settings, contacts, messages, jobs, integrations].some(
  (value) => value.error || value.errorCode,
);
const endpointsReady = report.edgeEndpoints.every(
  (endpoint) => endpoint.status === (endpoint.name === "whatsapp-webhook" ? 403 : 401),
);
if (
  queryFailure ||
  !endpointsReady ||
  !settings.data?.ai_enabled ||
  !contacts.data?.some((contact) => contact.active && contact.ai_access)
)
  process.exitCode = 1;
