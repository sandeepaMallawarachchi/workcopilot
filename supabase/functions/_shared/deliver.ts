import { db, env, check, required } from "./runtime.ts";
import { sendWhatsApp } from "../../../packages/agent-core/src/services/delivery.ts";
export async function deliver(jobId: string, lease: string) {
  const client = db();
  const items =
    check(
      await client.from("delivery_outbox").select("*").eq("job_id", jobId).order("part"),
    ) ?? [];
  for (const item of items) {
    if (item.status === "sent") continue;
    if (item.status === "failed" || item.status === "manual_review") return item.status;
    const claimed = check(
      await client.rpc("begin_delivery", { p_outbox: item.id, p_token: lease }),
    );
    if (!claimed) return "manual_review";
    const result = await sendWhatsApp(
      {
        token: required("WHATSAPP_ACCESS_TOKEN"),
        phoneId: required("WHATSAPP_PHONE_NUMBER_ID"),
        version: required("WHATSAPP_GRAPH_API_VERSION"),
      },
      claimed.recipient,
      claimed.body,
    );
    check(
      await client
        .from("delivery_outbox")
        .update({
          status: result.status,
          whatsapp_message_id: result.id ?? null,
          error: result.error ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id),
    );
    if (result.status !== "sent") return result.status;
  }
  return "completed";
}
