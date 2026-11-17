import PostalMime from "postal-mime";
import {
  imapDate,
  imapQuote,
  withImap,
  type ImapClient,
  type ImapConnect,
} from "./imap.ts";
import {
  extractVerification,
  isVerificationEmail,
  looksLikeVerificationHeaders,
  senderApproved,
} from "./verification.ts";

export type MailboxConfig = {
  id: string;
  label: string;
  address: string;
  host: string;
  port: number;
  username: string;
  password: string;
};

export type EmailSummary = {
  uid: number;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
};

const encoder = new TextEncoder();
const formatAddress = (a?: { name?: string; address?: string }) =>
  a ? (a.name ? `${a.name} <${a.address ?? ""}>` : (a.address ?? "")) : "";

/** Basic HTML → text for emails without a text part. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function parse(raw: Uint8Array) {
  const mail = await PostalMime.parse(raw);
  return {
    from: formatAddress(mail.from),
    to: (mail.to ?? []).map(formatAddress).join(", "),
    subject: mail.subject ?? "(no subject)",
    date: mail.date ?? "",
    text: mail.text?.trim() || htmlToText(mail.html ?? ""),
    html: mail.html ?? "",
    attachments: (mail.attachments ?? []).map((a) => a.filename ?? a.mimeType),
  };
}

async function summaries(client: ImapClient, uids: number[]): Promise<EmailSummary[]> {
  const fetched = await client.uidFetch(
    uids,
    "UID FLAGS INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)]",
  );
  const out: EmailSummary[] = [];
  for (const m of fetched) {
    if (!m.literal) continue;
    const headers = await parse(
      new Uint8Array([...m.literal, ...encoder.encode("\r\n")]),
    );
    out.push({
      uid: m.uid,
      from: headers.from,
      subject: headers.subject,
      date: headers.date || m.internalDate || "",
      unread: !/\\Seen/i.test(m.flags),
    });
  }
  return out.sort((a, b) => b.uid - a.uid);
}

export type SearchOptions = {
  query?: string;
  from?: string;
  sinceDays?: number;
  unreadOnly?: boolean;
  limit?: number;
};

/**
 * Newest-first search of the inbox. Sign-in/verification emails and blocked
 * senders are removed before anything leaves this function.
 */
export async function searchMailbox(
  connect: ImapConnect,
  box: MailboxConfig,
  options: SearchOptions,
  blockedSenders: string[] = [],
) {
  return withImap(connect, box, async (client) => {
    await client.examine("INBOX");
    const since = new Date(Date.now() - (options.sinceDays ?? 7) * 86400000);
    const criteria = [`SINCE ${imapDate(since)}`];
    if (options.unreadOnly) criteria.push("UNSEEN");
    if (options.from) criteria.push(`FROM ${imapQuote(options.from)}`);
    // Non-ASCII search terms would need IMAP literals; filter those locally instead.
    const asciiQuery = options.query && /^[\x20-\x7e]+$/.test(options.query);
    if (asciiQuery) criteria.push(`TEXT ${imapQuote(options.query!)}`);
    const uids = (await client.uidSearch(criteria.join(" "))).slice(-60);
    let found = await summaries(client, uids);
    if (options.query && !asciiQuery) {
      const q = options.query.toLowerCase();
      found = found.filter((m) => `${m.subject} ${m.from}`.toLowerCase().includes(q));
    }
    const visible = found.filter(
      (m) =>
        !looksLikeVerificationHeaders(m.subject, m.from) &&
        !senderApproved(m.from, blockedSenders),
    );
    return {
      emails: visible.slice(0, options.limit ?? 15),
      hiddenVerificationOrBlocked: found.length - visible.length,
    };
  });
}

/** Reads one email. Refuses sign-in/verification emails and blocked senders. */
export async function readEmail(
  connect: ImapConnect,
  box: MailboxConfig,
  uid: number,
  blockedSenders: string[] = [],
) {
  return withImap(connect, box, async (client) => {
    await client.examine("INBOX");
    const [m] = await client.uidFetch([uid], "UID FLAGS BODY.PEEK[]<0.200000>");
    if (!m?.literal) throw new Error("Email not found");
    const mail = await parse(m.literal);
    if (senderApproved(mail.from, blockedSenders))
      throw new Error("This sender is blocked in your email settings");
    if (isVerificationEmail(mail))
      throw new Error(
        "This looks like a sign-in or verification email, which is hidden from the assistant",
      );
    return {
      uid,
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      date: mail.date,
      unread: !/\\Seen/i.test(m.flags),
      text: mail.text.slice(0, 4000),
      truncated: mail.text.length > 4000,
      attachments: mail.attachments,
    };
  });
}

/**
 * Finds the newest sign-in email from an approved sender received in the last
 * `withinMinutes`, and extracts its code/link. Used only by the opt-in
 * verification-codes feature; the result never goes to the AI model.
 */
export async function findVerification(
  connect: ImapConnect,
  boxes: MailboxConfig[],
  approvedSenders: string[],
  hint: string,
  withinMinutes = 15,
) {
  const cutoff = Date.now() - withinMinutes * 60000;
  const unreachable: string[] = [];
  const candidates: {
    mailbox: string;
    from: string;
    subject: string;
    receivedAt: number;
    code?: string;
    link?: string;
  }[] = [];
  for (const box of boxes) {
    try {
      await withImap(connect, box, async (client) => {
        await client.examine("INBOX");
        const uids = (
          await client.uidSearch(`SINCE ${imapDate(new Date(cutoff))}`)
        ).slice(-20);
        for (const s of await summaries(client, uids)) {
          const receivedAt = Date.parse(s.date);
          if (!(receivedAt >= cutoff) || !senderApproved(s.from, approvedSenders))
            continue;
          const [m] = await client.uidFetch([s.uid], "UID BODY.PEEK[]<0.200000>");
          if (!m?.literal) continue;
          const mail = await parse(m.literal);
          const extracted = extractVerification(mail);
          if (!extracted.code && !extracted.link) continue;
          candidates.push({
            mailbox: box.label,
            from: mail.from,
            subject: mail.subject,
            receivedAt,
            ...extracted,
          });
        }
      });
    } catch {
      // One unreachable mailbox must not block the others, but report it.
      unreachable.push(box.label);
    }
  }
  // Service names in the request ("claude", "github") pick the right email;
  // generic words are ignored.
  const STOP = new Set(
    "code codes link links eka ekak otp verification verify sign signin login log magic email mail send give the and for please ewanna denna dennako mage my me what whats".split(
      " ",
    ),
  );
  const words = (hint.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(
    (w) => !STOP.has(w),
  );
  const relevant = candidates.filter((c) =>
    words.some((w) => `${c.from} ${c.subject}`.toLowerCase().includes(w)),
  );
  const pool = relevant.length ? relevant : candidates;
  return {
    match: pool.sort((a, b) => b.receivedAt - a.receivedAt)[0] ?? null,
    /** Mailboxes that could not be checked (sign-in or network failure). */
    unreachable,
  };
}

/** Verifies the credentials by signing in and opening the inbox read-only. */
export async function testMailbox(connect: ImapConnect, box: MailboxConfig) {
  await withImap(connect, box, (client) => client.examine("INBOX"), 15000);
}
