const patterns = [
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]+|glpat-[\w-]+|gsk_[\w]+|sk-[\w-]{12,}|AKIA[A-Z0-9]{16})\b/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi,
  /((?:[\w.-]*(?:password|passwd|secret|token|api[_-]?key|credential|private[_-]?key|authorization)[\w.-]*)["']?\s*[:=]\s*)[^\r\n,}]+/gi,
  /\b[A-Z][A-Z0-9_]{2,}\s*=\s*[^\r\n]+/g,
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi,
];
export function redact(value: string, secrets: string[] = []): string {
  let out = value;
  for (const secret of secrets.filter((s) => s.length >= 4))
    out = out.split(secret).join("[REDACTED]");
  for (const re of patterns) out = out.replace(re, "[REDACTED]");
  return out;
}
export function safePath(path: string): boolean {
  return !/(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|\.npmrc|\.netrc|service-account(?:\..*)?|credentials(?:\..*)?|secrets?(?:\..*)?)$|\.(?:pem|key|p12|pfx)$/i.test(
    path,
  );
}
export function credentialRequest(text: string): boolean {
  return /(?:show|reveal|print|send|give|expose|කියන්න|එවන්න|penwanna|ewanna|denna).{0,60}(?:password|token|secret|api.?key|private.?key)|(?:password|token|api.?key|secret).{0,30}(?:eka denna|එවන්න|penwanna)/i.test(
    text,
  );
}
