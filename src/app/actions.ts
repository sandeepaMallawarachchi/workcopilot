"use server";
import { z } from "zod";
import {
  loginSchema,
  loginFailureCode,
  type LoginErrorCode,
} from "@/lib/validation/login";
import type { FormActionResult } from "@/lib/types/form";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabase, service, configured } from "@/lib/supabase/server";
import { normalizePhone } from "../../packages/agent-core/src/services/policies";
import { githubToken } from "../../packages/agent-core/src/services/credentials";
import { api, record } from "../../packages/agent-core/src/tools/http";
import { testMailbox } from "../../packages/agent-core/src/email/mailbox";
import {
  sealSecret,
  openSecret,
} from "../../packages/agent-core/src/security/secret-box";
import { nodeImapConnect } from "@/lib/email/imap-transport";
import {
  type ContactResources,
  storedResources,
  parseContactAccess,
  parseShortcuts,
  storedShortcuts,
} from "../../packages/agent-core/src/services/shortcuts";
import {
  ALL_CAPABILITIES,
  parseBlockedPatterns,
} from "../../packages/agent-core/src/security/access";
function checked(result: { error: unknown }) {
  if (result.error) throw new Error("The database change could not be saved");
}
const idSchema = z.uuid();
export async function login(form: FormData) {
  if (!configured()) redirect("/setup");
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid_input");

  const db = await supabase();
  let failure: LoginErrorCode | null = null;
  try {
    const { error } = await db.auth.signInWithPassword(parsed.data);
    if (error) failure = loginFailureCode(error);
  } catch {
    failure = "unavailable";
  }
  // Keep redirects outside the catch: Next.js implements them by throwing.
  if (failure) redirect(`/login?error=${failure}`);
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
export async function updateContactAccess(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const id = idSchema.parse(form.get("id"));
  let allowed: string[] | null = null;
  if (form.get("all") !== "on") {
    try {
      allowed = parseContactAccess(JSON.parse(String(form.get("tasks") ?? "[]")));
    } catch {
      return { ok: false, message: "Invalid access selection." };
    }
  }
  // Repository / project / mailbox selection. Only sections the modal sent
  // are changed; hidden sections keep their previous value.
  const db = service();
  const { data: current } = await db
    .from("contacts")
    .select("resources")
    .eq("id", id)
    .eq("workspace_id", workspace)
    .single();
  const resources: ContactResources = storedResources(current?.resources);
  const pathList = (key: string) =>
    String(form.get(key) ?? "")
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  for (const provider of ["github", "gitlab"] as const) {
    const mode = form.get(`${provider}_mode`);
    if (mode === "all") delete resources[provider];
    if (mode === "selected") {
      const list = pathList(`${provider}_repos`);
      if (list.some((r) => !/^[\w.-]+(?:\/[\w.-]+)+$/.test(r)))
        return { ok: false, message: "Check the selected repository paths." };
      resources[provider] = [...new Set(list)].slice(0, 300);
    }
  }
  const mailboxMode = form.get("mailbox_mode");
  if (mailboxMode === "all") delete resources.mailboxes;
  if (mailboxMode === "selected") {
    const ids = form.getAll("mailbox_ids").map(String);
    const { data: owned } = await db
      .from("mailboxes")
      .select("id")
      .eq("workspace_id", workspace)
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    resources.mailboxes = (owned ?? []).map((m) => m.id);
  }
  checked(
    await db
      .from("contacts")
      .update({
        allowed_tasks: allowed,
        can_view_secrets: form.get("can_view_secrets") === "on",
        can_send_voice: form.get("can_send_voice") !== "off",
        resources,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", workspace),
  );
  revalidatePath("/contacts", "layout");
  return { ok: true, message: "Access saved." };
}
export async function saveSettings(form: FormData) {
  const { workspace } = await requireAdmin();
  const value = z
    .object({
      activation_prefix: z.string().regex(/^@[a-zA-Z]{1,12}$/),
      followup_minutes: z.coerce.number().int().min(0).max(60),
      voice_mode: z.enum(["off", "followup", "always"]),
      groq_model: z.string().trim().max(100),
      max_tool_calls: z.coerce.number().int().min(1).max(10),
      language_behavior: z.enum(["match", "English", "Sinhala", "Singlish"]),
      response_length: z.coerce.number().int().min(200).max(6000),
      context_messages: z.coerce.number().int().min(0).max(20),
      context_hours: z.coerce.number().int().min(1).max(168),
      retention_days: z.coerce.number().int().min(1).max(365),
    })
    .parse(Object.fromEntries(form));
  const { data: current } = await service()
    .from("agent_settings")
    .select("shortcuts")
    .eq("workspace_id", workspace)
    .single();
  if (
    storedShortcuts(current?.shortcuts).some(
      (s) => s.prefix.toLowerCase() === value.activation_prefix.toLowerCase(),
    )
  )
    throw new Error(`${value.activation_prefix} is already used by a shortcut.`);
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
    revalidatePath("/integrations", "layout");
    return { ok: true, message: "Integration disconnected." };
  }
  // "*" = every repository the credential can access (GitHub App installation /
  // GitLab project membership), resolved at run time.
  const allowAll = form.get("all") === "on";
  const allowed = allowAll
    ? ["*"]
    : z
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
    for (const repo of allowed.filter((r) => r !== "*"))
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
    revalidatePath("/integrations", "layout");
    return {
      ok: false,
      message:
        "Verification failed. Check your server credentials, repository paths, and access permissions.",
    };
  }
  revalidatePath("/integrations", "layout");
  return { ok: true, message: "Connection verified and repository selection saved." };
}
export async function saveIntegrationAccess(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const provider = z.enum(["github", "gitlab"]).parse(form.get("provider"));
  const capabilities = z
    .array(z.enum(ALL_CAPABILITIES as [string, ...string[]]))
    .parse(form.getAll("capabilities"));
  let blocked: string[];
  try {
    blocked = parseBlockedPatterns(String(form.get("blocked_paths") ?? ""));
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid path pattern.",
    };
  }
  checked(
    await service()
      .from("integrations")
      .update({ capabilities, blocked_paths: blocked })
      .eq("workspace_id", workspace)
      .eq("provider", provider),
  );
  revalidatePath("/integrations", "layout");
  return { ok: true, message: "Agent access rules saved." };
}
export async function saveShortcuts(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const db = service();
  const { data: settings } = await db
    .from("agent_settings")
    .select("activation_prefix")
    .eq("workspace_id", workspace)
    .single();
  let shortcuts;
  try {
    shortcuts = parseShortcuts(
      JSON.parse(String(form.get("shortcuts") ?? "[]")),
      settings?.activation_prefix ?? "@ai",
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid shortcuts." };
  }
  checked(
    await db
      .from("agent_settings")
      .update({ shortcuts, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace),
  );
  revalidatePath("/settings");
  return {
    ok: true,
    message: shortcuts.length
      ? `Saved ${shortcuts.length} shortcut${shortcuts.length === 1 ? "" : "s"}.`
      : "Shortcuts cleared.",
  };
}

// ---------------------------------------------------------------------------
// Email (read-only IMAP)
// ---------------------------------------------------------------------------
const HOST_PRESETS: Record<string, string> = {
  gmail: "imap.gmail.com",
  hostinger: "imap.hostinger.com",
  outlook: "outlook.office365.com",
};
const emailList = (value: FormDataEntryValue | null, max: number) => {
  const items = String(value ?? "")
    .split(/[\n,]+/)
    .map((v) => v.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  for (const item of items)
    if (!/^([\w.+-]+@)?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(item))
      throw new Error(`Not an email address or domain: ${item.slice(0, 60)}`);
  return [...new Set(items)].slice(0, max);
};

export async function saveMailbox(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const parsed = z
    .object({
      label: z.string().trim().min(1).max(40),
      address: z.string().trim().toLowerCase().email().max(254),
      preset: z.enum(["gmail", "hostinger", "outlook", "custom"]),
      host: z.string().trim().toLowerCase().max(253).optional(),
      username: z.string().trim().max(254).optional(),
      password: z.string().min(1).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Check the label, email address and password." };
  const v = parsed.data;
  const host = v.preset === "custom" ? (v.host ?? "") : HOST_PRESETS[v.preset];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host))
    return { ok: false, message: "Enter a valid IMAP server host name." };
  const box = {
    id: "",
    label: v.label,
    address: v.address,
    host,
    port: 993,
    username: v.username || v.address,
    password: v.password,
  };
  try {
    await testMailbox(nodeImapConnect, box);
  } catch (e) {
    return {
      ok: false,
      message:
        (e instanceof Error && /Sign-in failed|timed out/.test(e.message)
          ? e.message
          : "Couldn't connect to the mail server.") +
        (v.preset === "gmail"
          ? " Gmail needs an App Password, not your normal password."
          : ""),
    };
  }
  let ciphertext: string;
  try {
    ciphertext = await sealSecret(v.password, process.env.EMAIL_ENCRYPTION_KEY);
  } catch {
    return {
      ok: false,
      message:
        "EMAIL_ENCRYPTION_KEY is missing or invalid on the server. Add it, then try again.",
    };
  }
  const db = service();
  const { data, error } = await db
    .from("mailboxes")
    .upsert(
      {
        workspace_id: workspace,
        label: box.label,
        address: box.address,
        host: box.host,
        port: 993,
        username: box.username,
        status: "connected",
        error: null,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,address" },
    )
    .select("id")
    .single();
  checked({ error });
  checked(await db.from("mailbox_secrets").upsert({ mailbox_id: data!.id, ciphertext }));
  revalidatePath("/integrations", "layout");
  return { ok: true, message: `Connected ${box.address} (read-only).` };
}

export async function removeMailbox(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const id = z.uuid().parse(form.get("id"));
  checked(
    await service().from("mailboxes").delete().eq("id", id).eq("workspace_id", workspace),
  );
  revalidatePath("/integrations", "layout");
  return { ok: true, message: "Mailbox removed and its password deleted." };
}

export async function retestMailbox(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  const id = z.uuid().parse(form.get("id"));
  const db = service();
  const { data: box } = await db
    .from("mailboxes")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace)
    .single();
  const { data: secret } = await db
    .from("mailbox_secrets")
    .select("ciphertext")
    .eq("mailbox_id", id)
    .single();
  if (!box || !secret) return { ok: false, message: "Mailbox not found." };
  try {
    const password = await openSecret(
      secret.ciphertext,
      process.env.EMAIL_ENCRYPTION_KEY,
    );
    await testMailbox(nodeImapConnect, { ...box, password });
    checked(
      await db
        .from("mailboxes")
        .update({
          status: "connected",
          error: null,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", id),
    );
    revalidatePath("/integrations", "layout");
    return { ok: true, message: "Connection works." };
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 200) : "Connection failed";
    checked(
      await db.from("mailboxes").update({ status: "error", error: message }).eq("id", id),
    );
    revalidatePath("/integrations", "layout");
    return { ok: false, message };
  }
}

export async function saveEmailRules(form: FormData): Promise<FormActionResult> {
  const { workspace } = await requireAdmin();
  let blocked: string[], senders: string[];
  try {
    blocked = emailList(form.get("email_blocked_senders"), 50);
    senders = emailList(form.get("verification_senders"), 30);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid list." };
  }
  const enabled = form.get("verification_codes_enabled") === "on";
  if (enabled && !senders.length)
    return {
      ok: false,
      message:
        "Add at least one approved sender (e.g. anthropic.com) before turning on codes.",
    };
  checked(
    await service()
      .from("agent_settings")
      .update({
        email_blocked_senders: blocked,
        email_sent_enabled: form.get("email_sent_enabled") === "on",
        verification_codes_enabled: enabled,
        verification_senders: senders,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspace),
  );
  revalidatePath("/integrations", "layout");
  return { ok: true, message: "Email rules saved." };
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
