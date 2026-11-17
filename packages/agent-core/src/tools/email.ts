import { z } from "zod";
import type { ToolDefinition } from "../providers/types.ts";
import type { ImapConnect } from "../email/imap.ts";
import { readEmail, searchMailbox, type MailboxConfig } from "../email/mailbox.ts";

export const EMAIL_TOOLS = ["list_mailboxes", "search_emails", "get_email"] as const;

const args = z
  .object({
    mailbox: z.string().max(200).optional(),
    query: z.string().min(1).max(100).optional(),
    from: z.string().min(1).max(200).optional(),
    since_days: z.number().int().min(1).max(30).optional(),
    unread_only: z.boolean().optional(),
    uid: z.number().int().positive().optional(),
  })
  .strict();

/** Read-only email tools over the owner's connected mailboxes. */
export class EmailTools {
  constructor(
    readonly mailboxes: MailboxConfig[],
    private connect: ImapConnect,
    private blockedSenders: string[] = [],
  ) {}

  definitions(): ToolDefinition[] {
    const mailbox = { type: "string", description: "Mailbox label or address" };
    return [
      {
        type: "function",
        function: {
          name: "list_mailboxes",
          description: "Read only: list connected mailboxes.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "search_emails",
          description:
            "Read only: search inbox emails, newest first (omit mailbox to search all). Returns sender, subject, date, unread and uid.",
          parameters: {
            type: "object",
            properties: {
              mailbox,
              query: { type: "string" },
              from: { type: "string" },
              since_days: { type: "integer", description: "1-30, default 7" },
              unread_only: { type: "boolean" },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_email",
          description: "Read only: read one email by mailbox and uid from search_emails.",
          parameters: {
            type: "object",
            properties: { mailbox, uid: { type: "integer" } },
            required: ["mailbox", "uid"],
            additionalProperties: false,
          },
        },
      },
    ];
  }

  private pick(name?: string) {
    if (!name) return this.mailboxes;
    const n = name.trim().toLowerCase();
    const box = this.mailboxes.find(
      (b) => b.label.toLowerCase() === n || b.address.toLowerCase() === n,
    );
    if (!box)
      throw new Error("Unknown mailbox; use a label or address from list_mailboxes");
    return [box];
  }

  async execute(name: string, raw: string): Promise<unknown> {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed))
      if (v === "" || v === null) delete parsed[k];
    const a = args.parse(parsed);
    if (name === "list_mailboxes")
      return {
        mailboxes: this.mailboxes.map((b) => ({ mailbox: b.label, address: b.address })),
      };
    if (name === "search_emails") {
      const results = [];
      let hidden = 0;
      for (const box of this.pick(a.mailbox)) {
        const r = await searchMailbox(
          this.connect,
          box,
          {
            query: a.query,
            from: a.from,
            sinceDays: a.since_days,
            unreadOnly: a.unread_only,
          },
          this.blockedSenders,
        );
        hidden += r.hiddenVerificationOrBlocked;
        results.push(...r.emails.map((e) => ({ mailbox: box.label, ...e })));
      }
      return {
        emails: results.slice(0, 20),
        hidden_sign_in_or_blocked: hidden,
        note: hidden
          ? "Sign-in/verification emails and blocked senders are hidden from the assistant."
          : undefined,
      };
    }
    if (name === "get_email") {
      if (!a.uid) throw new Error("uid is required");
      const [box] = this.pick(a.mailbox);
      return {
        mailbox: box.label,
        ...(await readEmail(this.connect, box, a.uid, this.blockedSenders)),
      };
    }
    throw new Error("Unknown email tool");
  }
}
