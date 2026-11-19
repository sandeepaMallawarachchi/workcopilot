import { ServiceError } from "./policies.ts";

/** Groq's transcription limit for the free/dev tiers. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Downloads a WhatsApp media file: first resolve the media ID to a short-lived
 * URL, then fetch the bytes (both calls need the access token).
 */
export async function downloadWhatsAppMedia(
  config: { token: string; version: string },
  mediaId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }> {
  if (!/^[\w.-]{1,250}$/.test(mediaId)) throw new ServiceError("Invalid media ID");
  const meta = await fetcher(
    `https://graph.facebook.com/${config.version}/${encodeURIComponent(mediaId)}`,
    {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!meta.ok)
    throw new ServiceError(
      `Voice note download failed (${meta.status})`,
      meta.status >= 500,
    );
  const info = (await meta.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (
    !info.url ||
    !/^https:\/\/[^/]+\.(fbsbx|facebook|whatsapp)\.(com|net)\//.test(info.url)
  )
    throw new ServiceError("Voice note download failed (unexpected media URL)");
  if ((info.file_size ?? 0) > MAX_AUDIO_BYTES)
    throw new ServiceError("Voice note is too long to transcribe");
  const file = await fetcher(info.url, {
    headers: { Authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!file.ok)
    throw new ServiceError(
      `Voice note download failed (${file.status})`,
      file.status >= 500,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_AUDIO_BYTES)
    throw new ServiceError("Voice note is too long to transcribe");
  return { bytes, mimeType: info.mime_type ?? "audio/ogg" };
}

/** Transcribes audio with Groq Whisper (language auto-detected). */
export async function transcribe(
  apiKey: string,
  audio: { bytes: Uint8Array<ArrayBuffer>; mimeType: string },
  fetcher: typeof fetch = fetch,
  model = "whisper-large-v3-turbo",
): Promise<string> {
  const ext = audio.mimeType.includes("mpeg")
    ? "mp3"
    : audio.mimeType.includes("mp4") || audio.mimeType.includes("aac")
      ? "m4a"
      : audio.mimeType.includes("amr")
        ? "amr"
        : "ogg";
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio.bytes], { type: audio.mimeType.split(";")[0] }),
    `voice.${ext}`,
  );
  form.append("model", model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetcher("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new ServiceError(
      `Transcription failed (${res.status})`,
      res.status === 429 || res.status >= 500,
      res.status,
    );
  const body = (await res.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text.trim() : "";
}

/** Short quoted transcript shown above the reply so the sender sees what was heard. */
export function heardLine(transcript: string, max = 280) {
  const t = transcript.replace(/\s+/g, " ").trim();
  return `🎙️ _“${t.length > max ? t.slice(0, max - 1) + "…" : t}”_`;
}
