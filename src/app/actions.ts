"use server";
import { z } from "zod";
import type { FormActionResult } from "@/lib/types/form";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabase, service, configured } from "@/lib/supabase/server";
import { normalizePhone } from "../../packages/agent-core/src/services/policies";
import { githubToken } from "../../packages/agent-core/src/services/credentials";
import { api, record } from "../../packages/agent-core/src/tools/http";
function checked(result: { error: unknown }) {
  if (result.error) throw new Error("The database change could not be saved");
}
const idSchema = z.uuid();
export async function login(form: FormData) {
  if (!configured()) redirect("/setup");
  const email = z.email().parse(form.get("email"));
  const password = z.string().min(8).max(200).parse(form.get("password"));
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=login");
  redirect("/dashboard");
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
export async function addContact(form: FormData) {
  const { workspace } = await requireAdmin();
  const parsed = z
    .object({
      display_name: z.string().trim().min(1).max(100),
      phone: z.string().transform(normalizePhone),
      preferred_language: z.enum(["", "English", "Sinhala", "Singlish"]),
    })
    .parse(Object.fromEntries(form));
  checked(
    await service()
      .from("contacts")
      .insert({
        ...parsed,
        preferred_language: parsed.preferred_language || null,
        ai_access: form.get("ai_access") === "on",
        workspace_id: workspace,
      }),
  );
  revalidatePath("/contacts");
}
export async function updateContact(form: FormData) {
  const { workspace } = await requireAdmin();
  const id = idSchema.parse(form.get("id"));
  const operation = z.enum(["toggle", "access", "delete"]).parse(form.get("operation"));
  const db = service();
  if (operation === "delete")
    checked(
      await db.from("contacts").delete().eq("workspace_id", workspace).eq("id", id),
    );
  else {
    const field = operation === "toggle" ? "active" : "ai_access";
    checked(
      await db
        .from("contacts")
        .update({
          [field]: form.get("value") === "true",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", workspace),
    );
  }
  revalidatePath("/contacts");
}
export async function saveSettings(form: FormData) {
  const { workspace } = await requireAdmin();
  const value = z
    .object({
      activation_prefix: z.string().regex(/^@[a-zA-Z]{1,12}$/),
      groq_model: z.string().trim().max(100),
      max_tool_calls: z.coerce.number().int().min(1).max(10),
      language_behavior: z.enum(["match", "English", "Sinhala", "Singlish"]),
      response_length: z.coerce.number().int().min(200).max(6000),
      context_messages: z.coerce.number().int().min(0).max(20),
      context_hours: z.coerce.number().int().min(1).max(168),
      retention_days: z.coerce.number().int().min(1).max(365),
    })
    .parse(Object.fromEntries(form));
  checked(
    await service()
      .from("agent_settings")
      .update({
        ...value,
        ai_enabled: form.get("ai_enabled") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspace),
  );
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
export async function disableAI() {
  const { workspace } = await requireAdmin();
  checked(
    await service()
      .from("agent_settings")
      .update({ ai_enabled: false })
      .eq("workspace_id", workspace),
  );
  revalidatePath("/", "layout");
}
export async function integration(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const provider = z.enum(["github", "gitlab"]).parse(form.get("provider"));
  const db = service();
  if (form.get("operation") === "disconnect") {
    checked(
      await db
        .from("integrations")
        .update({
          status: "disconnected",
          account: null,
          allowed_repositories: [],
          error: null,
        })
        .eq("workspace_id", workspace)
        .eq("provider", provider),
    );
    revalidatePath("/integrations");
    return { ok: true, message: "Integration disconnected." };
  }
  const allowed = z
    .array(z.string().regex(/^[\w.-]+(?:\/[\w.-]+)+$/))
    .max(50)
    .parse(
      String(form.get("repositories") ?? "")
        .split(/[\s,]+/)
        .filter(Boolean),
    );
  try {
    const token =
      provider === "github"
        ? await githubToken((k) => process.env[k])
        : process.env.GITLAB_TOKEN;
    if (!token) throw new Error("Credential missing");
    const base =
      provider === "github"
        ? "https://api.github.com"
        : (process.env.GITLAB_BASE_URL || "https://gitlab.com") + "/api/v4";
    if (provider === "gitlab" && new URL(base).origin !== "https://gitlab.com")
      throw new Error("Only GitLab.com is enabled");
    let account: string;
    if (provider === "github" && process.env.GITHUB_APP_ID) {
      const r = record(
        await api(base + "/installation/repositories?per_page=1", token, provider),
      );
      if (!("repositories" in r)) throw new Error("Installation authentication failed");
      account = "App installation " + process.env.GITHUB_INSTALLATION_ID;
    } else {
      const r = record(await api(base + "/user", token, provider));
      account = String(r.login ?? r.username ?? r.id);
    }
    for (const repo of allowed)
      await api(
        base +
          (provider === "github"
            ? "/repos/" + repo
            : "/projects/" + encodeURIComponent(repo)),
        token,
        provider,
      );
    checked(
      await db
        .from("integrations")
        .update({
          status: "connected",
          account,
          allowed_repositories: allowed,
          last_sync_at: new Date().toISOString(),
          error: null,
        })
        .eq("workspace_id", workspace)
        .eq("provider", provider),
    );
  } catch {
    checked(
      await db
        .from("integrations")
        .update({
          status: "error",
          error:
            "Verification failed. Check server credentials, scopes and selected repositories.",
        })
        .eq("workspace_id", workspace)
        .eq("provider", provider),
    );
    revalidatePath("/integrations");
    return {
      ok: false,
      message:
        "Verification failed. Check your server credentials, repository paths, and access permissions.",
    };
  }
  revalidatePath("/integrations");
  return { ok: true, message: "Connection verified and repository selection saved." };
}
export async function clearHistory(form: FormData) {
  const { workspace, user } = await requireAdmin();
  const id = idSchema.parse(form.get("id"));
  checked(
    await service().rpc("reset_conversation", {
      p_workspace: workspace,
      p_conversation: id,
      p_actor: user.id,
    }),
  );
  revalidatePath("/conversations");
}
