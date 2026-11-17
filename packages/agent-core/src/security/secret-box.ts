/**
 * AES-256-GCM encryption for stored credentials (mailbox passwords).
 * The key comes from EMAIL_ENCRYPTION_KEY (32 random bytes, base64) and lives
 * only in server environments; the database stores ciphertext only.
 * Works with WebCrypto in both Node (dashboard) and Deno (worker).
 */

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function importKey(keyBase64: string | undefined) {
  if (!keyBase64) throw new Error("EMAIL_ENCRYPTION_KEY is not configured");
  const raw = unb64(keyBase64.trim());
  if (raw.length !== 32)
    throw new Error("EMAIL_ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealSecret(plain: string, keyBase64: string | undefined) {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  return `v1:${b64(iv)}:${b64(cipher)}`;
}

export async function openSecret(sealed: string, keyBase64: string | undefined) {
  const [version, iv, cipher] = sealed.split(":");
  if (version !== "v1" || !iv || !cipher) throw new Error("Unsupported secret format");
  const key = await importKey(keyBase64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    key,
    unb64(cipher),
  );
  return new TextDecoder().decode(plain);
}
