import { createClient } from "@supabase/supabase-js";
import { constantTime } from "../../../packages/agent-core/src/services/webhook.ts";
export const env = (key: string) => Deno.env.get(key);
export function required(key: string) {
  const value = env(key);
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
}
export function db() {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function internal(req: Request) {
  const expected = env("INTERNAL_JOB_SECRET");
  return (
    !!expected &&
    expected.length >= 32 &&
    constantTime(req.headers.get("x-internal-secret") ?? "", expected)
  );
}
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("Database operation failed");
  return result.data;
}
export function secrets() {
  return [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
    "GROQ_API_KEY",
    "GITHUB_TOKEN",
    "GITLAB_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INTERNAL_JOB_SECRET",
    "GITHUB_APP_PRIVATE_KEY",
  ]
    .map((k) => env(k) ?? "")
    .filter(Boolean);
}
