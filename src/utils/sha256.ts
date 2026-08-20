/** Minimal Web Crypto wrapper for the app's export/integrity features. */
export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = input instanceof Uint8Array ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available in this environment');
  }
  const digest = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return toHex(digest);
}