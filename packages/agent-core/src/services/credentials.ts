type Env = (key: string) => string | undefined;
function base64url(data: Uint8Array) {
  return btoa(String.fromCharCode(...data))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function githubToken(env: Env): Promise<string> {
  const app = env("GITHUB_APP_ID"),
    pem = env("GITHUB_APP_PRIVATE_KEY"),
    installation = env("GITHUB_INSTALLATION_ID");
  if (app && pem && installation) {
    const header = base64url(
      new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    );
    const now = Math.floor(Date.now() / 1000);
    const payload = base64url(
      new TextEncoder().encode(
        JSON.stringify({ iat: now - 60, exp: now + 540, iss: app }),
      ),
    );
    const raw = Uint8Array.from(
      atob(
        pem
          .replace(/\\n/g, "\n")
          .replace(/-----[^-]+-----/g, "")
          .replace(/\s/g, ""),
      ),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "pkcs8",
      raw,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(header + "." + payload),
    );
    const response = await fetch(
      `https://api.github.com/app/installations/${encodeURIComponent(installation)}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${header}.${payload}.${base64url(new Uint8Array(sig))}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          permissions: {
            contents: "read",
            issues: "read",
            pull_requests: "read",
            metadata: "read",
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("GitHub App authentication failed");
    const result = await response.json();
    if (typeof result.token !== "string")
      throw new Error("Invalid GitHub App response");
    return result.token;
  }
  if (env("ALLOW_DEV_GITHUB_TOKEN") === "true" && env("GITHUB_TOKEN"))
    return env("GITHUB_TOKEN")!;
  throw new Error(
    "GitHub App credentials are not configured (development tokens require explicit opt-in)",
  );
}
