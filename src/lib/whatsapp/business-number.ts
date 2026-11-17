/**
 * The WhatsApp business number contacts message (e.g. "+1 555 150 7221").
 * WHATSAPP_DISPLAY_NUMBER overrides; otherwise it is read from Meta using the
 * phone number ID and token, cached for a day. Returns null when unavailable.
 */
export async function businessNumber(): Promise<{
  display: string;
  test: boolean;
} | null> {
  const override = process.env.WHATSAPP_DISPLAY_NUMBER?.trim();
  if (override) return { display: override, test: false };
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v24.0";
  if (!token || !id || !/^\d+$/.test(id) || !/^v\d+\.\d+$/.test(version)) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${id}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
    };
    if (!body.display_phone_number) return null;
    const display = body.display_phone_number.startsWith("+")
      ? body.display_phone_number
      : `+${body.display_phone_number}`;
    return { display, test: /test number/i.test(body.verified_name ?? "") };
  } catch {
    return null;
  }
}
