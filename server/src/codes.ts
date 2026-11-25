import { normalizeFamilyCode } from '../../shared/sync/code';
import { FAMILY_WORDS } from './words';

const encoder = new TextEncoder();
const NO_MATCH = '0'.repeat(64);

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
  return Array.from(random, (n) => FAMILY_WORDS[n & (FAMILY_WORDS.length - 1)]).join('-');
}

export function readFamilyCode(header: string | null): string | undefined {
  if (header?.slice(0, 7).toLowerCase() !== 'family ') return undefined;
  return normalizeFamilyCode(header.slice(7)) ?? undefined;
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
