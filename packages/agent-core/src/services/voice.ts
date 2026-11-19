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

type Audio = { bytes: Uint8Array<ArrayBuffer>; mimeType: string };
type Segment = { text?: string; avg_logprob?: number; no_speech_prob?: number };
type WhisperResult = { text: string; language?: string; segments?: Segment[] };

/** One Whisper call (verbose JSON gives language and per-segment confidence). */
async function whisper(
  apiKey: string,
  audio: Audio,
  opts: { model: string; language?: string; prompt?: string },
  fetcher: typeof fetch,
): Promise<WhisperResult> {
  const mime = audio.mimeType.split(";")[0];
  const ext = mime.includes("mpeg")
    ? "mp3"
    : mime.includes("mp4") || mime.includes("aac")
      ? "m4a"
      : mime.includes("amr")
        ? "amr"
        : "ogg";
  const form = new FormData();
  form.append("file", new Blob([audio.bytes], { type: mime }), `voice.${ext}`);
  form.append("model", opts.model);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);
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
  const body = (await res.json()) as {
    text?: unknown;
    language?: unknown;
    segments?: unknown;
  };
  return {
    text: typeof body.text === "string" ? body.text : "",
    language: typeof body.language === "string" ? body.language.toLowerCase() : undefined,
    segments: Array.isArray(body.segments) ? (body.segments as Segment[]) : undefined,
  };
}

/** Whisper often labels Sinhala speech as one of these. */
const SINHALA_LIKE = new Set([
  "si",
  "sinhala",
  "sinhalese",
  "hi",
  "hindi",
  "ta",
  "tamil",
  "ur",
  "urdu",
  "bn",
  "bengali",
  "ne",
  "nepali",
  "mr",
  "marathi",
  "ml",
  "malayalam",
  "pa",
  "punjabi",
  "gu",
  "gujarati",
  "kn",
  "kannada",
  "te",
  "telugu",
  "sa",
  "sanskrit",
  "dv",
  "divehi",
]);

/** Known silence hallucinations of Whisper. */
const HALLUCINATIONS =
  /^(thank you( (very much|for watching))?|thanks for watching|please subscribe|subtitles? by .*|you|bye|\.+)[.!]?$/i;

const isNoise = (s: Segment) =>
  (s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -0.8;

/** Keeps confident segments only and drops typical hallucinations. */
function cleanResult(r: WhisperResult) {
  const text = r.segments?.length
    ? r.segments
        .filter((s) => !isNoise(s))
        .map((s) => s.text ?? "")
        .join("")
    : r.text;
  const t = text.replace(/\s+/g, " ").trim();
  return HALLUCINATIONS.test(t) ? "" : t;
}

function confidence(r: WhisperResult) {
  // Ignore segments that are dropped as noise anyway.
  const segs =
    r.segments?.filter((s) => typeof s.avg_logprob === "number" && !isNoise(s)) ?? [];
  return segs.length ? segs.reduce((a, s) => a + s.avg_logprob!, 0) / segs.length : 0;
}

/** Whisper prompt (max ~224 tokens) that biases spelling and style. */
export function vocabularyPrompt(vocabulary: string[], sinhala: boolean) {
  const terms = [
    "WorkCopilot",
    "GitHub",
    "GitLab",
    "README",
    "commit",
    "pull request",
    "merge request",
    "pipeline",
    "repo",
    "branch",
    "email",
    "inbox",
    "OTP",
    ...vocabulary,
  ];
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].join(", ");
  const base = sinhala
    ? `AI, මගේ GitHub repo එකේ last commit එක මොකක්ද? GitHub, README එක එවන්න. Email, අද mail මොනවද? ${unique}.`
    : `AI, what's the latest commit in my GitHub repo? GitHub, send the README. Email, any new emails? ${unique}.`;
  return base.slice(0, 700);
}

/** Fixes split or misspelled names: "project lens" → "projectlens", "git hub" → "GitHub". */
export function fixVocabulary(text: string, vocabulary: string[]) {
  let out = text
    .replace(/\bgit ?hub\b/gi, "GitHub")
    .replace(/\bgit ?lab\b/gi, "GitLab")
    .replace(/\bread ?me\b/gi, "README")
    .replace(/\bwork ?co ?pilot\b/gi, "WorkCopilot")
    .replace(/\bo\.? ?t\.? ?p\b/gi, "OTP");
  for (const term of [...new Set(vocabulary)].sort((a, b) => b.length - a.length)) {
    const letters = term.replace(/[^A-Za-z0-9]/g, "");
    if (letters.length < 5) continue;
    const pattern = letters
      .split("")
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s._-]?");
    out = out.replace(new RegExp(`\\b${pattern}\\b`, "gi"), term);
  }
  return out;
}

/**
 * Transcribes a voice note, tuned for English, Sinhala and Singlish:
 * - Sinhala/Singlish speakers (by preference or detection) use whisper-large-v3
 *   with language "si" and a Sinhala-script prompt that keeps tech words in Latin.
 * - English uses the fast turbo model, retried with large-v3 when confidence is low.
 * - Known names are corrected afterwards; silence hallucinations are dropped.
 */
export async function transcribe(
  apiKey: string,
  audio: Audio,
  fetcher: typeof fetch = fetch,
  options: { language?: string | null; vocabulary?: string[] } = {},
): Promise<string> {
  const vocabulary = options.vocabulary ?? [];
  const pref = (options.language ?? "").toLowerCase();
  const sinhalaPref = pref === "sinhala" || pref === "singlish";
  const englishPref = pref === "english";
  const sinhalaPass = () =>
    whisper(
      apiKey,
      audio,
      {
        model: "whisper-large-v3",
        language: "si",
        prompt: vocabularyPrompt(vocabulary, true),
      },
      fetcher,
    );

  let result: WhisperResult;
  if (sinhalaPref) {
    result = await sinhalaPass();
  } else {
    result = await whisper(
      apiKey,
      audio,
      {
        model: "whisper-large-v3-turbo",
        language: englishPref ? "en" : undefined,
        prompt: vocabularyPrompt(vocabulary, false),
      },
      fetcher,
    );
    const lang = result.language;
    if (!englishPref && lang && SINHALA_LIKE.has(lang)) {
      result = await sinhalaPass();
    } else if (confidence(result) < -0.7 && cleanResult(result)) {
      // Unsure English: the full model is slower but more accurate.
      const retry = await whisper(
        apiKey,
        audio,
        {
          model: "whisper-large-v3",
          language: "en",
          prompt: vocabularyPrompt(vocabulary, false),
        },
        fetcher,
      );
      if (confidence(retry) > confidence(result)) result = retry;
    }
  }
  return fixVocabulary(cleanResult(result), vocabulary);
}

/** Short quoted transcript shown above the reply so the sender sees what was heard. */
export function heardLine(transcript: string, max = 280) {
  const t = transcript.replace(/\s+/g, " ").trim();
  return `🎙️ _“${t.length > max ? t.slice(0, max - 1) + "…" : t}”_`;
}
