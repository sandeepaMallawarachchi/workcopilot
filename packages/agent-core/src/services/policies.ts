export function normalizePhone(phone: string) {
  const raw = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw))
    throw new Error("Use an international phone number");
  const normalized = "+" + raw.replace(/\D/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized))
    throw new Error("Use an international phone number");
  return normalized;
}
export function activation(text: string, prefix = "@ai"): string | null {
  const trimmed = text.trimStart();
  if (trimmed.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase())
    return null;
  const rest = trimmed.slice(prefix.length);
  if (!/^\s/.test(rest)) return null;
  return rest.trim() || null;
}
export function authorized(
  contact: { active: boolean; ai_access: boolean } | null,
  enabled: boolean,
  text: string,
  prefix = "@ai",
) {
  return enabled && !!contact?.active && contact.ai_access
    ? activation(text, prefix)
    : null;
}
export function retryDelay(attempt: number) {
  return Math.min(900, 15 * 2 ** attempt);
}
export class ServiceError extends Error {
  constructor(
    public code: string,
    public retryable = false,
    public status = 0,
  ) {
    super(code);
  }
}
export function assertReadOnly(method: string) {
  if (method !== "GET")
    throw new ServiceError("Read-only policy denied operation");
}
