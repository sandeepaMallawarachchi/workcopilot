import { assertReadOnly, ServiceError } from "../services/policies.ts";
export async function api(
  url: string,
  token: string,
  provider: "github" | "gitlab",
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  assertReadOnly("GET");
  const res = await fetcher(url, {
    method: "GET",
    redirect: "error",
    headers:
      provider === "github"
        ? {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          }
        : { "PRIVATE-TOKEN": token },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
  });
  if (!res.ok)
    throw new ServiceError(
      `${provider} API ${res.status}${res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0" ? " (rate limited)" : ""}`,
      res.status === 429 || res.status >= 500,
      res.status,
    );
  if (Number(res.headers.get("content-length") ?? 0) > 500000)
    throw new ServiceError("API response exceeds safe size");
  const reader = res.body?.getReader();
  if (!reader) throw new ServiceError("Empty API response");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 500000) {
      await reader.cancel();
      throw new ServiceError("API response exceeds safe size");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function record(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}
export function array(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.map(record) : [];
}
export function project(data: unknown, keys: string[]): unknown {
  if (Array.isArray(data))
    return data.slice(0, 20).map((x) => project(x, keys));
  const r = record(data);
  return Object.fromEntries(keys.filter((k) => k in r).map((k) => [k, r[k]]));
}
export function decodeBase64(value: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
  );
}
