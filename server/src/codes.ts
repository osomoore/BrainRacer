import { FAMILY_WORDS } from './words';

const encoder = new TextEncoder();
const NO_MATCH = '0'.repeat(64);
const CODE_FORMAT = /^[A-Z]{3,12}(?:-[A-Z]{3,12}){2}-[0-9]{2}$/;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export function newFamilyId(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export function newFamilyCode(): string {
  const random = crypto.getRandomValues(new Uint16Array(4));
  const words = Array.from(random.subarray(0, 3), (n) => FAMILY_WORDS[n & 2047].toUpperCase());
  // Rejection sampling keeps all 100 digit pairs equally likely.
  while (random[3] >= 65_500) crypto.getRandomValues(random.subarray(3));
  return [...words, String(random[3] % 100).padStart(2, '0')].join('-');
}

export function readFamilyCode(header: string | null): string | undefined {
  const code = /^Family ([a-z0-9-]{1,41})$/i.exec(header ?? '')?.[1].toUpperCase();
  return code && CODE_FORMAT.test(code) ? code : undefined;
}

export function matchesHash(candidate: string, stored: string | undefined): boolean {
  const left = encoder.encode(candidate);
  const right = encoder.encode(stored ?? NO_MATCH);
  const subtle: SubtleCrypto & { timingSafeEqual?(a: Uint8Array, b: Uint8Array): boolean } = crypto.subtle;
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(left, right);

  // Node's Web Crypto, used by the handler tests, has no timingSafeEqual extension.
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}
