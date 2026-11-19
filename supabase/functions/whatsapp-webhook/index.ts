import { webhookHandler } from "../../../packages/agent-core/src/services/webhook.ts";
import { db, required, check, secrets } from "../_shared/runtime.ts";
import { redact } from "../../../packages/agent-core/src/security/sanitization.ts";
Deno.serve(
  webhookHandler({
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    appSecret: required("WHATSAPP_APP_SECRET"),
    phoneId: required("WHATSAPP_PHONE_NUMBER_ID"),
    businessId: required("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    async accept(m) {
      check(
        await db().rpc("accept_message", {
          p_wa_id: m.id,
          p_phone: m.phone,
          p_text: redact(m.text, secrets()),
          p_sent_at: m.sentAt,
          ...(m.mediaId ? { p_media_id: m.mediaId } : {}),
        }),
      );
    },
  }),
);
