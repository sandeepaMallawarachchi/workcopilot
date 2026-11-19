import { z } from "zod";
import { normalizePhone } from "./policies.ts";
export function constantTime(a: string, b: string) {
  const x = new TextEncoder().encode(a),
    y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
export async function verifySignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  return constantTime(signature, "sha256=" + hex);
}
const payload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            messages: z
              .array(
                z.object({
                  id: z.string().max(250),
                  from: z.string(),
                  type: z.string(),
                  timestamp: z.string(),
                  text: z.object({ body: z.string().max(12000) }).optional(),
                  audio: z
                    .object({
                      id: z.string().max(250),
                      mime_type: z.string().max(100).optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});
export function webhookHandler(config: {
  verifyToken: string;
  appSecret: string;
  phoneId: string;
  businessId: string;
  accept: (message: {
    id: string;
    phone: string;
    text: string;
    sentAt: string;
    /** Set for voice notes / audio: Meta media ID to transcribe later. */
    mediaId?: string;
  }) => Promise<void>;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      return q.get("hub.mode") === "subscribe" &&
        !!config.verifyToken &&
        constantTime(q.get("hub.verify_token") ?? "", config.verifyToken) &&
        q.has("hub.challenge")
        ? new Response(q.get("hub.challenge"))
        : new Response("Verification failed", { status: 403 });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (Number(req.headers.get("content-length") ?? 0) > 1000000)
      return new Response("Too large", { status: 413 });
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 1000000)
      return new Response("Too large", { status: 413 });
    if (
      !(await verifySignature(
        raw,
        req.headers.get("x-hub-signature-256"),
        config.appSecret,
      ))
    )
      return new Response("Invalid signature", { status: 401 });
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    const data = payload.safeParse(decoded);
    if (!data.success) return new Response("Ignored", { status: 200 });
    try {
      for (const entry of data.data.entry) {
        if (entry.id !== config.businessId) continue;
        for (const change of entry.changes) {
          if (
            change.field !== "messages" ||
            change.value.metadata?.phone_number_id !== config.phoneId
          )
            continue;
          for (const m of change.value.messages ?? []) {
            const voice = m.type === "audio" && m.audio?.id;
            if (!voice && (m.type !== "text" || !m.text)) continue;
            const time = Number(m.timestamp) * 1000;
            if (!Number.isFinite(time) || time < 0 || time > 8640000000000000) continue;
            await config.accept({
              id: m.id,
              phone: normalizePhone(m.from),
              text: voice ? "" : m.text!.body,
              sentAt: new Date(time).toISOString(),
              ...(voice ? { mediaId: m.audio!.id } : {}),
            });
          }
        }
      }
    } catch {
      return new Response("Temporary acceptance failure", { status: 503 });
    }
    return new Response("Accepted", { status: 200 });
  };
}
