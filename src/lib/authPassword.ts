export function internalEmailFor(userId: string): string {
  return `${userId}@darzitouna.local`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function deriveAuthPassword(userId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}
