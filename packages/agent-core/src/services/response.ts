import { redact } from "../security/sanitization.ts";
export function splitReply(text: string, max = 3400, mask = true): string[] {
  const chars = Array.from(
    (mask ? redact(text) : text).replace(/\*\*(.+?)\*\*/g, "*$1*"),
  );
  const parts: string[] = [];
  while (chars.length) {
    let n = Math.min(max, chars.length);
    if (n < chars.length) {
      const window = chars.slice(0, n).join("");
      const i = window.lastIndexOf("\n");
      if (i > max / 2) n = Array.from(window.slice(0, i + 1)).length;
    }
    parts.push(chars.splice(0, n).join(""));
  }
  return parts.length ? parts : ["I could not generate a reply. Please try again."];
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Markdown table → one bullet per row: "• first cell — Header: value · …". */
function tableToList(rows: string[]) {
  const [head, , ...body] = rows.map(cells);
  const keep = head
    .map((h, i) => (/^(#|no\.?|n)$/i.test(h) ? -1 : i))
    .filter((i) => i >= 0);
  return body
    .map((row) => {
      const [first, ...rest] = keep.filter((i) => row[i]);
      if (first === undefined) return "";
      const details = rest.map((i) => (head[i] ? `${head[i]}: ${row[i]}` : row[i]));
      return `• ${row[first]}${details.length ? ` — ${details.join(" · ")}` : ""}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Converts Markdown to WhatsApp formatting. WhatsApp supports *bold*, _italic_,
 * ~strike~, `code`, ```blocks```, "- " lists and "> " quotes, but not tables,
 * headings, **bold** or [text](url) links.
 */
export function toWhatsApp(markdown: string): string {
  const out: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      out.push(line.trim().startsWith("```") ? "```" : line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const rows = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++]);
      i--;
      out.push(tableToList(rows));
      continue;
    }
    let l = line
      .replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/, (_, h) => `*${h.replace(/\*\*/g, "")}*`)
      .replace(/^\s*([-*_])\1{2,}\s*$/, "")
      .replace(/^(\s*)[*+]\s+/, "$1• ")
      .replace(/^(\s*)-\s+(?!\[)/, "$1• ")
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      .replace(/__(.+?)__/g, "*$1*")
      .replace(/~~(.+?)~~/g, "~$1~")
      .replace(
        /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
        (_, alt, url) => `${alt || "image"}: ${url}`,
      )
      .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, text, url) =>
        text === url || url.endsWith(text) ? url : `${text} (${url})`,
      )
      .replace(/<(https?:\/\/[^>\s]+)>/g, "$1");
    l = l.replace(/\\([|*_~`#])/g, "$1");
    out.push(l);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
