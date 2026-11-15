import { redact } from "../security/sanitization.ts";
export function splitReply(text: string, max = 3400): string[] {
  const chars = Array.from(redact(text).replace(/\*\*/g, "*"));
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
  return parts.length
    ? parts
    : ["I could not generate a reply. Please try again."];
}
