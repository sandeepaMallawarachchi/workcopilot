/**
 * Minimal, read-only IMAP4rev1 client.
 *
 * - Runtime-agnostic: works over any byte transport (Node tls / Deno.connectTls).
 * - Read-only by construction: mailboxes are opened with EXAMINE and bodies are
 *   fetched with BODY.PEEK, so nothing is ever marked as read, moved or deleted.
 *   No command in this file can modify a mailbox.
 */

export type ImapTransport = {
  write(data: Uint8Array): Promise<void>;
  /** Reads into buf; resolves to bytes read, or null at end of stream. */
  read(buf: Uint8Array): Promise<number | null>;
  close(): void;
};
export type ImapConnect = (host: string, port: number) => Promise<ImapTransport>;

export class ImapError extends Error {}

export type ImapResponse = { text: string; literals: Uint8Array[] };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CRLF = [13, 10];

function concat(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Quotes a string for an IMAP command; rejects characters that need literals. */
export function imapQuote(value: string) {
  if (/[\r\n\x00]/.test(value) || /[^\x20-\x7e]/.test(value))
    throw new ImapError("Unsupported characters in IMAP argument");
  return `"${value.replace(/[\\"]/g, (c) => "\\" + c)}"`;
}

/** IMAP date format: 17-Nov-2026 */
export function imapDate(date: Date) {
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${date.getUTCDate()}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export class ImapClient {
  private buffer = new Uint8Array(0);
  private tagCounter = 0;
  private readonly chunk = new Uint8Array(16384);

  constructor(private transport: ImapTransport) {}

  private async fill() {
    const n = await this.transport.read(this.chunk);
    if (n === null || n === 0) throw new ImapError("Connection closed by server");
    this.buffer = concat(this.buffer, this.chunk.subarray(0, n));
  }

  private async readLine(): Promise<string> {
    for (;;) {
      for (let i = 0; i + 1 < this.buffer.length; i++) {
        if (this.buffer[i] === CRLF[0] && this.buffer[i + 1] === CRLF[1]) {
          const line = decoder.decode(this.buffer.subarray(0, i));
          this.buffer = this.buffer.subarray(i + 2);
          return line;
        }
      }
      if (this.buffer.length > 4 * 1024 * 1024)
        throw new ImapError("Response line too long");
      await this.fill();
    }
  }

  private async readBytes(n: number): Promise<Uint8Array> {
    while (this.buffer.length < n) await this.fill();
    const out = this.buffer.slice(0, n);
    this.buffer = this.buffer.subarray(n);
    return out;
  }

  /** Reads one full response, following {n} literals. */
  private async readResponse(): Promise<ImapResponse> {
    let text = "";
    const literals: Uint8Array[] = [];
    for (;;) {
      const line = await this.readLine();
      const literal = /\{(\d+)\}$/.exec(line);
      if (!literal) return { text: text + line, literals };
      const size = Number(literal[1]);
      if (size > 8 * 1024 * 1024) throw new ImapError("Message too large");
      text += line.slice(0, -literal[0].length) + `{literal:${literals.length}}`;
      literals.push(await this.readBytes(size));
    }
  }

  async greeting() {
    const res = await this.readResponse();
    if (!/^\* (OK|PREAUTH)/i.test(res.text))
      throw new ImapError("Unexpected server greeting");
  }

  /** Sends a command and collects untagged responses until the tagged reply. */
  async command(cmd: string): Promise<ImapResponse[]> {
    const tag = `W${++this.tagCounter}`;
    await this.transport.write(encoder.encode(`${tag} ${cmd}\r\n`));
    const untagged: ImapResponse[] = [];
    for (;;) {
      const res = await this.readResponse();
      if (res.text.startsWith(tag + " ")) {
        if (!/^\S+ OK/i.test(res.text))
          throw new ImapError(res.text.slice(tag.length + 1, 200) || "Command failed");
        return untagged;
      }
      if (res.text.startsWith("+"))
        throw new ImapError("Unexpected continuation request");
      untagged.push(res);
    }
  }

  async login(username: string, password: string) {
    // SASL PLAIN with initial response: handles any password characters safely.
    const bytes = encoder.encode(`\0${username}\0${password}`);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    try {
      await this.command(`AUTHENTICATE PLAIN ${btoa(binary)}`);
    } catch {
      throw new ImapError("Sign-in failed. Check the email address and (app) password.");
    }
  }

  /** Opens a mailbox read-only. */
  async examine(mailbox = "INBOX") {
    await this.command(`EXAMINE ${imapQuote(mailbox)}`);
  }

  /** Lists folders with their attributes (LIST is read-only). */
  async list(): Promise<{ name: string; attributes: string[] }[]> {
    const responses = await this.command(`LIST "" "*"`);
    const out: { name: string; attributes: string[] }[] = [];
    for (const r of responses) {
      const m = /^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.+)$/i.exec(r.text);
      if (!m) continue;
      const raw = m[2].trim();
      const literal = /^\{literal:(\d+)\}$/.exec(raw);
      const name = literal
        ? decoder.decode(r.literals[Number(literal[1])])
        : raw.startsWith('"')
          ? raw.slice(1, -1).replace(/\\(.)/g, "$1")
          : raw;
      out.push({ name, attributes: m[1].split(/\s+/).filter(Boolean) });
    }
    return out;
  }

  async uidSearch(criteria: string): Promise<number[]> {
    const responses = await this.command(`UID SEARCH ${criteria}`);
    const ids: number[] = [];
    for (const r of responses) {
      const m = /^\* SEARCH(.*)$/i.exec(r.text);
      if (m)
        for (const id of m[1].trim().split(/\s+/))
          if (/^\d+$/.test(id)) ids.push(Number(id));
    }
    return ids.sort((a, b) => a - b);
  }

  /** UID FETCH; items must only use PEEK forms (enforced). */
  async uidFetch(uids: number[], items: string) {
    // BODY[...] and RFC822 / RFC822.TEXT set \Seen; only PEEK forms are allowed.
    if (
      /BODY\[/i.test(items.replace(/BODY\.PEEK\[/gi, "")) ||
      /RFC822(?!\.SIZE|\.HEADER)/i.test(items)
    )
      throw new ImapError("Only BODY.PEEK fetches are allowed (read-only)");
    if (!uids.length) return [];
    const responses = await this.command(`UID FETCH ${uids.join(",")} (${items})`);
    return responses
      .filter((r) => /^\* \d+ FETCH/i.test(r.text))
      .map((r) => ({
        uid: Number(/UID (\d+)/i.exec(r.text)?.[1] ?? 0),
        flags: /FLAGS \(([^)]*)\)/i.exec(r.text)?.[1] ?? "",
        internalDate: /INTERNALDATE "([^"]+)"/i.exec(r.text)?.[1],
        literal: r.literals[0],
      }))
      .filter((m) => m.uid > 0);
  }

  async logout() {
    try {
      await this.command("LOGOUT");
    } catch {
      // ignore: the server may close first
    }
  }
}

/** Opens a session, runs fn, and always closes the connection. */
export async function withImap<T>(
  connect: ImapConnect,
  config: { host: string; port: number; username: string; password: string },
  fn: (client: ImapClient) => Promise<T>,
  timeoutMs = 20000,
): Promise<T> {
  const transport = await connect(config.host, config.port);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      transport.close();
      reject(new ImapError("Mail server timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const client = new ImapClient(transport);
        await client.greeting();
        await client.login(config.username, config.password);
        const result = await fn(client);
        await client.logout();
        return result;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    transport.close();
  }
}
