import { matchesHash, newFamilyCode, newFamilyId, readFamilyCode, sha256 } from './codes';
import type { Profile, ProfileChange, Snapshot, SyncStore } from './store';

export const MAX_DATA_BYTES = 256 * 1024;
// A JSON character can use a six-byte escape. Leave room for the request envelope.
const MAX_BODY_BYTES = 6 * MAX_DATA_BYTES + 4096;
const MINUTE = 60_000;
export const RATE_LIMITS = {
  create: { windowMs: 60 * MINUTE, limit: 10 },
  ip: { windowMs: MINUTE, limit: 60 },
  family: { windowMs: MINUTE, limit: 120 },
};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function allowedOrigin(origin: string): boolean {
  if (origin === 'https://osomoore.github.io') return true;
  if (!/^http:\/\/(?:[a-z0-9.]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/.test(origin)) return false;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
    if (/^\[f[cd][a-f0-9]{2}:/.test(hostname)) return true;
    if (!/^\d+(?:\.\d+){3}$/.test(hostname)) return false;
    const [a, b] = hostname.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  } catch {
    return false;
  }
}

function* snapshotChunks({ serverTime, profiles }: Snapshot): Generator<string> {
  yield `{"serverTime":${serverTime},"profiles":[`;
  for (const [index, { id, rev, updatedAt, deleted, data }] of profiles.entries()) {
    const comma = index === 0 ? '' : ',';
    const tombstone = deleted ? ',"deleted":true' : '';
    // The PUT handler validated and serialized data before it reached the store.
    yield `${comma}{"id":${JSON.stringify(id)},"rev":${rev},"updatedAt":${updatedAt}${tombstone},"data":${data}}`;
  }
  yield ']}';
}

function snapshotResponse(snapshot: Snapshot, headers: Headers): Response {
  const chunks = snapshotChunks(snapshot);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const { value, done } = chunks.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
  });
  headers.set('Content-Type', 'application/json');
  return new Response(body, { headers });
}

function conflictProfile(id: string, profile: Profile | null) {
  if (!profile) return { id, rev: 0, updatedAt: 0, data: null };
  return { id, rev: profile.rev, updatedAt: profile.updatedAt, data: JSON.parse(profile.data) as unknown };
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function tooLarge(): never {
  throw new RequestError(413, 'Profile data exceeds 256 KiB');
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.body) throw new RequestError(400, 'Expected a JSON body');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    void request.body.cancel().catch(() => {});
    tooLarge();
  }
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(decoder.decode(body)) as unknown;
  } catch {
    throw new RequestError(400, 'Invalid JSON');
  }
}

async function readPut(request: Request): Promise<ProfileChange> {
  const value = await readBody(request);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Expected a profile object');
  }
  const { baseRev, deleted, data } = value as Record<string, unknown>;
  if (typeof baseRev !== 'number' || !Number.isSafeInteger(baseRev) || baseRev < 0
    || (deleted !== undefined && typeof deleted !== 'boolean') || data === undefined) {
    throw new RequestError(400, 'Expected baseRev, data and optional deleted flag');
  }
  let json: string;
  try {
    json = JSON.stringify(data);
  } catch {
    throw new RequestError(400, 'Invalid profile data');
  }
  if (encoder.encode(json).byteLength > MAX_DATA_BYTES) tooLarge();
  return { kind: 'put', baseRev, data: json, deleted: deleted === true };
}

function profileId(segment: string): string {
  try {
    const id = decodeURIComponent(segment);
    if (id && !id.includes('\0')) return id;
  } catch {
    // Malformed percent escape.
  }
  throw new RequestError(400, 'Invalid profile ID');
}

export async function handleRequest(request: Request, store: SyncStore, now = Date.now()): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  const corsAllowed = origin !== null && allowedOrigin(origin);
  if (corsAllowed) headers.set('Access-Control-Allow-Origin', origin);

  function reply(status: number, body: object = {}, serverTime = now): Response {
    return Response.json({ ...body, serverTime }, { status, headers });
  }

  async function limit(scope: keyof typeof RATE_LIMITS, key: string) {
    const { windowMs, limit } = RATE_LIMITS[scope];
    if (!await store.takeRateLimit(scope, key, now, windowMs, limit)) {
      headers.set('Retry-After', String(Math.ceil((windowMs - now % windowMs) / 1000)));
      if (corsAllowed) headers.set('Access-Control-Expose-Headers', 'Retry-After');
      throw new RequestError(429, 'Too many requests');
    }
  }

  try {
    if (origin !== null && !corsAllowed) return reply(403, { error: 'Origin not allowed' });

    const url = new URL(request.url);
    const isFamily = url.pathname === '/v1/family';
    const profile = /^\/v1\/family\/profile\/([^/]+)$/.exec(url.pathname);
    if (!isFamily && !profile) return reply(404, { error: 'Unknown route' });

    const methods = isFamily ? 'GET, POST, DELETE, OPTIONS' : 'PUT, DELETE, OPTIONS';
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', methods);
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      return reply(200);
    }
    if (!methods.split(', ').includes(request.method)) {
      headers.set('Allow', methods);
      return reply(405, { error: 'Method not allowed' });
    }

    // Cloudflare supplies this header at the public edge. Local requests share a bucket if absent.
    const ipKey = await sha256(request.headers.get('CF-Connecting-IP') ?? 'local');
    if (request.method === 'POST') {
      await limit('create', ipKey);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = newFamilyCode();
        if (await store.createFamily({ id: newFamilyId(), codeHash: await sha256(code) }, now)) {
          return reply(201, { code });
        }
      }
      return reply(503, { error: 'Could not create family' });
    }

    await limit('ip', ipKey);
    const code = readFamilyCode(request.headers.get('Authorization'));
    const hash = await sha256(code ?? '');
    const family = await store.findFamily(hash);
    const hashMatches = matchesHash(hash, family?.codeHash);
    const unauthorized = () => reply(401, { error: 'Invalid family code' });
    if (!hashMatches || !family || !code) return unauthorized();
    await limit('family', family.id);

    if (request.method === 'GET') {
      const rawSince = url.searchParams.get('since');
      const since = rawSince === null ? -1 : Number(rawSince);
      if (rawSince !== null && (!/^\d+$/.test(rawSince) || !Number.isSafeInteger(since))) {
        throw new RequestError(400, 'Invalid since cursor');
      }
      const snapshot = await store.snapshot(family.id, since, now);
      if (!snapshot) return unauthorized();
      return snapshotResponse(snapshot, headers);
    }

    if (!profile) return await store.deleteFamily(family.id) ? reply(200) : unauthorized();

    const id = profileId(profile[1]);
    const change: ProfileChange = request.method === 'PUT' ? await readPut(request) : { kind: 'delete' };
    const result = await store.changeProfile(family.id, id, change, now);
    switch (result.kind) {
      case 'ok':
        return reply(200, { rev: result.rev, updatedAt: result.updatedAt }, result.serverTime);
      case 'conflict':
        return reply(409, { current: conflictProfile(id, result.current) });
      case 'full':
        return reply(413, { error: 'Family has reached its profile limit' });
      case 'missing-family':
        return unauthorized();
    }
  } catch (error) {
    if (error instanceof RequestError) return reply(error.status, { error: error.message });
    // Never return or log raw storage errors, which can include private inputs.
    return reply(500, { error: 'Sync temporarily unavailable' });
  }
}
