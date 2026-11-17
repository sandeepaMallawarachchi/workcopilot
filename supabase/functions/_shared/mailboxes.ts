import type { SupabaseClient } from "@supabase/supabase-js";
import type { MailboxConfig } from "../../../packages/agent-core/src/email/mailbox.ts";
import { openSecret } from "../../../packages/agent-core/src/security/secret-box.ts";
import { env } from "./runtime.ts";

/**
 * Loads connected mailboxes with decrypted passwords. Returns [] when email is
 * not set up (no migration, no key, no mailboxes) so the agent keeps working.
 */
export async function loadMailboxes(
  client: SupabaseClient,
  workspace: string,
): Promise<MailboxConfig[]> {
  const key = env("EMAIL_ENCRYPTION_KEY");
  if (!key) return [];
  const { data: boxes, error } = await client
    .from("mailboxes")
    .select("id,label,address,host,port,username")
    .eq("workspace_id", workspace);
  if (error || !boxes?.length) return [];
  const { data: secrets } = await client
    .from("mailbox_secrets")
    .select("mailbox_id,ciphertext")
    .in(
      "mailbox_id",
      boxes.map((b) => b.id),
    );
  const out: MailboxConfig[] = [];
  for (const box of boxes) {
    const sealed = secrets?.find((s) => s.mailbox_id === box.id)?.ciphertext;
    if (!sealed) continue;
    try {
      out.push({ ...box, password: await openSecret(sealed, key) });
    } catch {
      // Undecryptable (rotated key): skip this mailbox.
    }
  }
  return out;
}
