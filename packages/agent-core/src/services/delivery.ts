export type DeliveryResult = {
  status: "sent" | "pending" | "failed" | "manual_review";
  id?: string;
  error?: string;
};
const META_HINTS: Record<number, string> = {
  190: "access token is invalid or expired; generate a new token and update WHATSAPP_ACCESS_TOKEN",
  10: "token lacks whatsapp_business_messaging permission or app is not linked to this WhatsApp account",
  200: "token lacks whatsapp_business_messaging permission",
  100: "invalid parameter; WHATSAPP_PHONE_NUMBER_ID is likely wrong (use the Phone number ID, not the phone number or WABA ID)",
  131030:
    "recipient is not in the Meta test number's allowed list; add it under WhatsApp > API Setup > To",
  131047:
    "more than 24 hours since the user's last message; a template message is required",
  131026:
    "message undeliverable; recipient may not have WhatsApp or must accept new terms",
  133010: "phone number is not registered with the Cloud API",
  368: "account temporarily blocked for policy violations",
};

async function describeMetaError(res: Response, token: string) {
  let detail = "";
  try {
    const body = (await res.json()) as {
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
        error_data?: { details?: string };
        fbtrace_id?: string;
      };
    };
    const e = body.error;
    if (e) {
      const code = e.code ?? 0;
      const hint = META_HINTS[code];
      detail = [
        `code ${code}${e.error_subcode ? `/${e.error_subcode}` : ""}`,
        e.error_data?.details ?? e.message,
        hint && `hint: ${hint}`,
        e.fbtrace_id && `fbtrace ${e.fbtrace_id}`,
      ]
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    // Non-JSON body; fall back to status only.
  }
  const text = `Meta rejected message (${res.status})${detail ? `: ${detail}` : "; check recipient, access token and 24-hour service window"}`;
  // Never persist anything resembling a credential.
  return (token.length >= 8 ? text.split(token).join("[redacted]") : text)
    .replace(/EAA[A-Za-z0-9]{20,}/g, "[redacted]")
    .slice(0, 500);
}

export async function sendWhatsApp(
  config: {
    token: string;
    phoneId: string;
    version: string;
    recipients: string[];
  },
  recipient: string,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (!config.recipients.includes(recipient))
    return {
      status: "failed",
      error: "Recipient is not a permitted Meta test recipient",
    };
  if (!config.token || !config.phoneId || !/^v\d+\.\d+$/.test(config.version))
    return { status: "failed", error: "WhatsApp configuration incomplete" };
  try {
    const res = await fetcher(
      `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient.slice(1),
          type: "text",
          text: { preview_url: false, body: text },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (res.status === 429)
      return {
        status: "pending",
        error: "Meta rate limited; safe to retry rejected request",
      };
    if (res.status >= 500)
      return {
        status: "manual_review",
        error: "Meta server error; delivery outcome uncertain",
      };
    if (!res.ok)
      return {
        status: "failed",
        error: await describeMetaError(res, config.token),
      };
    const data = await res.json();
    const id = data.messages?.[0]?.id;
    return typeof id === "string"
      ? { status: "sent", id }
      : {
          status: "manual_review",
          error: "Meta accepted request without a message ID",
        };
  } catch {
    return {
      status: "manual_review",
      error: "Network timeout or malformed response; delivery outcome uncertain",
    };
  }
}

/**
 * Marks the incoming message as read and shows WhatsApp's "typing…" indicator.
 * Meta clears it when a reply is sent or after ~25 seconds. Best effort only:
 * failures never affect processing.
 */
export async function sendTypingIndicator(
  config: { token: string; phoneId: string; version: string },
  incomingMessageId: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!config.token || !config.phoneId || !/^v\d+\.\d+$/.test(config.version))
    return false;
  try {
    const res = await fetcher(
      `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: incomingMessageId,
          typing_indicator: { type: "text" },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
