import { describe, it, expect, vi } from "vitest";
import {
  downloadWhatsAppMedia,
  heardLine,
  transcribe,
} from "../packages/agent-core/src/services/voice";
import { webhookHandler } from "../packages/agent-core/src/services/webhook";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("voice notes", () => {
  it("downloads WhatsApp media via the media ID and a Meta-hosted URL", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1",
          mime_type: "audio/ogg; codecs=opus",
          file_size: 3,
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    const audio = await downloadWhatsAppMedia({ token: "t", version: "v24.0" }, "123", f);
    expect(audio.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(audio.mimeType).toContain("audio/ogg");
    expect(String(f.mock.calls[0][0])).toBe("https://graph.facebook.com/v24.0/123");
  });
  it("refuses unexpected media hosts and oversized files", async () => {
    await expect(
      downloadWhatsAppMedia(
        { token: "t", version: "v24.0" },
        "1",
        vi.fn<typeof fetch>().mockResolvedValue(json({ url: "https://evil.example/x" })),
      ),
    ).rejects.toThrow("unexpected media URL");
    await expect(
      downloadWhatsAppMedia(
        { token: "t", version: "v24.0" },
        "1",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            json({ url: "https://x.fbsbx.com/a", file_size: 30 * 1024 * 1024 }),
          ),
      ),
    ).rejects.toThrow("too long");
  });
  it("transcribes with Groq Whisper and marks rate limits retryable", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ text: " latest commit in projectlens " }));
    const text = await transcribe(
      "k",
      { bytes: new Uint8Array([1]), mimeType: "audio/ogg" },
      f,
    );
    expect(text).toBe("latest commit in projectlens");
    const body = f.mock.calls[0][1]?.body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3-turbo");
    await expect(
      transcribe(
        "k",
        { bytes: new Uint8Array([1]), mimeType: "audio/ogg" },
        vi.fn<typeof fetch>().mockResolvedValue(json({}, 429)),
      ),
    ).rejects.toMatchObject({ retryable: true });
  });
  it("shows a short quote of what was heard", () => {
    expect(heardLine("hello   there")).toBe("🎙️ _“hello there”_");
    expect(heardLine("x".repeat(400)).length).toBeLessThan(300);
  });
  it("passes audio messages from the webhook with their media ID", async () => {
    const accept = vi.fn(async (_message: { mediaId?: string; text: string }) => {});
    const handler = webhookHandler({
      verifyToken: "v",
      appSecret: "secret",
      phoneId: "p",
      businessId: "b",
      accept,
    });
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "b",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "p" },
                messages: [
                  {
                    id: "wamid.1",
                    from: "94771234567",
                    type: "audio",
                    timestamp: "1794800000",
                    audio: { id: "media-9", mime_type: "audio/ogg" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
    );
    const hex = [...sig].map((x) => x.toString(16).padStart(2, "0")).join("");
    const res = await handler(
      new Request("https://x/", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": `sha256=${hex}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept.mock.calls[0][0]).toMatchObject({ mediaId: "media-9", text: "" });
  });
});

describe("transcription tuning for English, Sinhala and Singlish", () => {
  const audio = { bytes: new Uint8Array([1]), mimeType: "audio/ogg; codecs=opus" };
  const call = (f: ReturnType<typeof vi.fn>, i: number) =>
    f.mock.calls[i][1].body as FormData;

  it("uses large-v3 with Sinhala for Sinhala/Singlish speakers", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ text: "මගේ last commit එක", language: "sinhala" }));
    const text = await transcribe("k", audio, f, {
      language: "Singlish",
      vocabulary: ["projectlens"],
    });
    expect(text).toBe("මගේ last commit එක");
    expect(f).toHaveBeenCalledTimes(1);
    expect(call(f, 0).get("model")).toBe("whisper-large-v3");
    expect(call(f, 0).get("language")).toBe("si");
    expect(String(call(f, 0).get("prompt"))).toContain("projectlens");
  });
  it("re-runs as Sinhala when Whisper mislabels Sinhala speech", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ text: "मगे कमिट", language: "hindi" }))
      .mockResolvedValueOnce(json({ text: "මගේ commit එක", language: "sinhala" }));
    expect(await transcribe("k", audio, f, { language: "match" })).toBe("මගේ commit එක");
    expect(call(f, 0).get("model")).toBe("whisper-large-v3-turbo");
    expect(call(f, 1).get("language")).toBe("si");
  });
  it("retries unsure English with the full model and keeps the better result", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          text: "lates comet",
          language: "english",
          segments: [{ text: "lates comet", avg_logprob: -1.2 }],
        }),
      )
      .mockResolvedValueOnce(
        json({
          text: "latest commit",
          language: "english",
          segments: [{ text: "latest commit", avg_logprob: -0.2 }],
        }),
      );
    expect(await transcribe("k", audio, f, { language: "English" })).toBe(
      "latest commit",
    );
    expect(call(f, 1).get("model")).toBe("whisper-large-v3");
  });
  it("drops silence hallucinations and low-confidence noise", async () => {
    const silent = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ text: "Thank you.", language: "english" }));
    expect(await transcribe("k", audio, silent)).toBe("");
    const noisy = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        text: "latest commit blah",
        language: "english",
        segments: [
          { text: "latest commit", avg_logprob: -0.2, no_speech_prob: 0.01 },
          { text: " blah", avg_logprob: -1.5, no_speech_prob: 0.9 },
        ],
      }),
    );
    expect(await transcribe("k", audio, noisy)).toBe("latest commit");
  });
  it("fixes split names and common tech words", async () => {
    const { fixVocabulary } = await import("../packages/agent-core/src/services/voice");
    expect(
      fixVocabulary("send the read me of project lens from git hub and log-sonar", [
        "projectlens",
        "logsonar",
      ]),
    ).toBe("send the README of projectlens from GitHub and logsonar");
  });
});
