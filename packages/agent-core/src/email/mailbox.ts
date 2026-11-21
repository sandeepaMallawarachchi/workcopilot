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
  /** Recipients; only listed for sent mail. */
  to?: string;
  subject: string;
  date: string;
  unread: boolean;
};

/** Which folder to read: the inbox, or the opt-in Sent folder. */
export type Folder = "inbox" | "sent";

/** Common Sent folder names, for servers without the \Sent attribute (RFC 6154). */
const SENT_NAMES = new Set([
  "sent",
  "sent items",
  "sent mail",
  "sent messages",
  "[gmail]/sent mail",
  "inbox.sent",
  "inbox/sent",
]);

/** Opens the folder read-only (EXAMINE). The Sent folder is found by attribute, then name. */
export async function openFolder(client: ImapClient, folder: Folder = "inbox") {
  if (folder === "inbox") return client.examine("INBOX");
  const folders = await client.list();
  const sent =
    folders.find((f) => f.attributes.some((a) => a.toLowerCase() === "\\sent")) ??
    folders.find((f) => SENT_NAMES.has(f.name.toLowerCase()));
  if (!sent) throw new Error("No Sent folder was found in this mailbox");
  await client.examine(sent.name);
}

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

async function summaries(
  client: ImapClient,
  uids: number[],
  withRecipients = false,
): Promise<EmailSummary[]> {
  const fetched = await client.uidFetch(
    uids,
    "UID FLAGS INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)]",
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
      ...(withRecipients ? { to: headers.to } : {}),
      subject: headers.subject,
      date: headers.date || m.internalDate || "",
      unread: !/\\Seen/i.test(m.flags),
    });
  }
  return out.sort((a, b) => b.uid - a.uid);
}

export type SearchOptions = {
  folder?: Folder;
  query?: string;
  from?: string;
  to?: string;
  sinceDays?: number;
  unreadOnly?: boolean;
  limit?: number;
};

/** Blocked addresses are hidden whether they sent the email or received it. */
const blockedIn = (m: { from: string; to?: string }, blocked: string[]) =>
  senderApproved(m.from, blocked) ||
  (m.to ?? "").split(",").some((r) => r.trim() && senderApproved(r, blocked));

/**
 * Newest-first search of the inbox (or the Sent folder). Sign-in/verification
 * emails and blocked senders are removed before anything leaves this function.
 */
export async function searchMailbox(
  connect: ImapConnect,
  box: MailboxConfig,
  options: SearchOptions,
  blockedSenders: string[] = [],
) {
  const sent = options.folder === "sent";
  return withImap(connect, box, async (client) => {
    await openFolder(client, options.folder);
    const since = new Date(Date.now() - (options.sinceDays ?? 7) * 86400000);
    const criteria = [`SINCE ${imapDate(since)}`];
    if (options.unreadOnly) criteria.push("UNSEEN");
    if (options.from) criteria.push(`FROM ${imapQuote(options.from)}`);
    if (options.to) criteria.push(`TO ${imapQuote(options.to)}`);
    // Non-ASCII search terms would need IMAP literals; filter those locally instead.
    const asciiQuery = options.query && /^[\x20-\x7e]+$/.test(options.query);
    if (asciiQuery) criteria.push(`TEXT ${imapQuote(options.query!)}`);
    const uids = (await client.uidSearch(criteria.join(" "))).slice(-60);
    let found = await summaries(client, uids, sent);
    if (options.query && !asciiQuery) {
      const q = options.query.toLowerCase();
      found = found.filter((m) =>
        `${m.subject} ${m.from} ${m.to ?? ""}`.toLowerCase().includes(q),
      );
    }
    const visible = found.filter(
      (m) =>
        !looksLikeVerificationHeaders(m.subject, m.from) && !blockedIn(m, blockedSenders),
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
  folder: Folder = "inbox",
) {
  return withImap(connect, box, async (client) => {
    await openFolder(client, folder);
    const [m] = await client.uidFetch([uid], "UID FLAGS BODY.PEEK[]<0.200000>");
    if (!m?.literal) throw new Error("Email not found");
    const mail = await parse(m.literal);
    if (blockedIn(mail, blockedSenders))
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
  /** Domains of recent sign-in emails from senders that are not approved. */
  const unapproved = new Set<string>();
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
          if (!(receivedAt >= cutoff)) continue;
          if (!senderApproved(s.from, approvedSenders)) {
            // Tell the owner which sender to approve (never the code itself).
            if (looksLikeVerificationHeaders(s.subject, s.from)) {
              const address = (/<([^>]+)>/.exec(s.from)?.[1] ?? s.from).toLowerCase();
              const domain = address.split("@")[1]?.split(".").slice(-2).join(".");
              if (domain) unapproved.add(domain);
            }
            continue;
          }
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
    unapproved: [...unapproved],
  };
}

/** Verifies the credentials by signing in and opening the inbox read-only. */
export async function testMailbox(connect: ImapConnect, box: MailboxConfig) {
  await withImap(connect, box, (client) => client.examine("INBOX"), 15000);
}
