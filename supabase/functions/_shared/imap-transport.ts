import type { ImapConnect } from "../../../packages/agent-core/src/email/imap.ts";

/** IMAP over TLS for the Deno-based Edge Functions. */
export const denoImapConnect: ImapConnect = async (hostname, port) => {
  const conn = await Deno.connectTls({ hostname, port });
  return {
    write: async (data) => {
      let written = 0;
      while (written < data.length) written += await conn.write(data.subarray(written));
    },
    read: (buf) => conn.read(buf),
    close: () => {
      try {
        conn.close();
      } catch {
        // already closed
      }
    },
  };
};
