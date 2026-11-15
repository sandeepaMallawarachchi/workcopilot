export type DeliveryResult = {
  status: "sent" | "pending" | "failed" | "manual_review";
  id?: string;
  error?: string;
};
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
        error: `Meta rejected message (${res.status}); check recipient, access token and 24-hour service window`,
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
      error:
        "Network timeout or malformed response; delivery outcome uncertain",
    };
  }
}
