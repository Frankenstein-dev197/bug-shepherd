// Shared helpers for API key hashing and lookup.

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey(): { plain: string; prefix: string; last4: string } {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const prefix = "trg_live";
  const plain = `${prefix}_${body}`;
  return { plain, prefix, last4: body.slice(-4) };
}