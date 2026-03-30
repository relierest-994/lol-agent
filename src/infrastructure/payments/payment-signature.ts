function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web crypto subtle API is not available');
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(signature);
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(',')}]`;
  const obj = input as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

export async function buildPaymentSignature(secret: string, payload: Record<string, unknown>): Promise<string> {
  return hmacSha256(secret, stableStringify(payload));
}

export async function verifyPaymentSignature(input: {
  secret: string;
  payload: Record<string, unknown>;
  signature: string;
}): Promise<boolean> {
  const expected = await buildPaymentSignature(input.secret, input.payload);
  return expected === input.signature;
}
