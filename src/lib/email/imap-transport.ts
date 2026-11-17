import tls from "node:tls";
import type { ImapConnect } from "../../../packages/agent-core/src/email/imap";

/** IMAP over TLS for the Node.js dashboard server (verify / test mailboxes). */
export const nodeImapConnect: ImapConnect = (host, port) =>
  new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    const chunks: Buffer[] = [];
    let waiting: ((n: number | null) => void) | null = null;
    let target: Uint8Array | null = null;
    let ended = false;
    const deliver = () => {
      if (!waiting || !target) return;
      if (chunks.length) {
        const chunk = chunks[0];
        const n = Math.min(chunk.length, target.length);
        target.set(chunk.subarray(0, n));
        if (n < chunk.length) chunks[0] = chunk.subarray(n);
        else chunks.shift();
        const done = waiting;
        waiting = target = null;
        done(n);
      } else if (ended) {
        const done = waiting;
        waiting = target = null;
        done(null);
      }
    };
    socket.on("data", (d: Buffer) => {
      chunks.push(d);
      deliver();
    });
    socket.on("end", () => {
      ended = true;
      deliver();
    });
    socket.on("close", () => {
      ended = true;
      deliver();
    });
    socket.once("error", (e) => {
      ended = true;
      deliver();
      reject(e);
    });
    socket.once("secureConnect", () =>
      resolve({
        write: (data) =>
          new Promise((ok, fail) => socket.write(data, (e) => (e ? fail(e) : ok()))),
        read: (buf) =>
          new Promise((r) => {
            waiting = r;
            target = buf;
            deliver();
          }),
        close: () => socket.destroy(),
      }),
    );
  });
