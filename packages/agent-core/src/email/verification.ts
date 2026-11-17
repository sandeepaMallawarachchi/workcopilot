/**
 * Sign-in / verification email handling.
 *
 * These emails work like passwords for a few minutes, so:
 * - They are ALWAYS hidden from the AI model (search results and reads).
 * - Only the opt-in "verification codes" feature can deliver one, and it does
 *   so deterministically (no AI), only from approved senders, only recent ones.
 */

const VERIFICATION_TEXT =
  /\b(verification|verify|one[- ]?time|otp|passcode|security code|sign[- ]?in|log[- ]?in|magic link|login link|confirm (your )?(email|account|sign)|reset (your )?password|password reset|2fa|two[- ]factor|authentication code|access code|confirmation code|your code)\b/i;

/** Headers-only check (used to filter search results without downloading bodies). */
export function looksLikeVerificationHeaders(subject: string, from: string): boolean {
  return (
    VERIFICATION_TEXT.test(subject) ||
    (/\b(no-?reply|noreply|security|accounts?|auth|verify|login)@/i.test(from) &&
      /\b(code|link|sign|log|verify|confirm|secure)\b/i.test(subject))
  );
}

/** Full check including the body. Fails closed when a code-like pattern appears. */
export function isVerificationEmail(email: {
  subject: string;
  from: string;
  text: string;
}) {
  if (looksLikeVerificationHeaders(email.subject, email.from)) return true;
  const head = email.text.slice(0, 3000);
  return (
    VERIFICATION_TEXT.test(head) &&
    (/\b\d{4,8}\b/.test(head) ||
      /https?:\/\/\S*(token|auth|magic|verify|login|signin|sign-in|otp)/i.test(head))
  );
}

/** Does the WhatsApp message ask for a sign-in code or link? */
export function asksForVerificationCode(message: string): boolean {
  return /\b(otp|verification|verify|sign[- ]?in|log[- ]?in|login|magic)\b.{0,40}\b(code|link|eka|email|mail)\b|\b(code|link) (eka|ekak)\b|\botp\b|\b2fa\b/i.test(
    message,
  );
}

/** True when the sender's address or domain is on the approved list. */
export function senderApproved(from: string, approved: string[]): boolean {
  const address = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  return approved.some((entry) => {
    const e = entry.trim().toLowerCase().replace(/^@/, "");
    if (!e) return false;
    return e.includes("@") ? address === e : domain === e || domain.endsWith("." + e);
  });
}

/** Pulls the code and/or sign-in link out of an email, without any AI. */
export function extractVerification(email: {
  subject: string;
  text: string;
  html?: string;
}) {
  const body = `${email.subject}\n${email.text}`;
  const near =
    /(?:code|otp|passcode|pin)[^0-9]{0,40}\b(\d{4,8})\b|\b(\d{4,8})\b[^0-9]{0,40}(?:is your|code|otp|passcode)/i.exec(
      body,
    );
  const code = near?.[1] ?? near?.[2];
  const urls = [
    ...`${email.text}\n${email.html ?? ""}`.matchAll(/https:\/\/[^\s"'<>)\]]+/g),
  ].map((m) => m[0].replace(/&amp;/g, "&"));
  const link = urls.find((u) =>
    /(magic|verify|verification|login|log-in|signin|sign-in|auth|token|confirm)/i.test(u),
  );
  return { code, link };
}

/** Unambiguous requests (not e.g. "login page code" about a repository). */
export function stronglyAsksForVerificationCode(message: string): boolean {
  return /\b(otp|2fa|verification (code|link|email)|magic link|sign[- ]?in (code|link)|log[- ]?in (code|link)|security code)\b/i.test(
    message,
  );
}

/** WhatsApp texts for a found code: what is sent vs. what is kept in history. */
export function verificationMessages(
  found: {
    mailbox: string;
    from: string;
    subject: string;
    receivedAt: number;
    code?: string;
    link?: string;
  },
  now = Date.now(),
) {
  const minutes = Math.max(0, Math.round((now - found.receivedAt) / 60000));
  const sender = found.from.replace(/\s*<[^>]+>/, "") || found.from;
  const lines = [`🔐 ${sender} — ${found.subject}`];
  if (found.code) lines.push(`Code: *${found.code}*`);
  if (found.link) lines.push(`Sign-in link: ${found.link}`);
  lines.push(
    `Received ${minutes} min ago in ${found.mailbox}. Use it now and don't forward it.`,
  );
  return {
    sent: lines.join("\n"),
    // History is resent to the AI later, so the code/link is never stored there.
    stored: `🔐 Delivered a sign-in ${found.code ? "code" : "link"} from ${sender} (hidden from history).`,
  };
}
