export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type JsonObject = Record<string, unknown>;

export const object = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const stamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const profileId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && !Object.hasOwn(Object.prototype, value);

export class SyncError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

function httpMessage(status: number): string {
  switch (status) {
    case 401: return 'Family code was not accepted.';
    case 413: return 'This profile is too large to sync.';
    case 429: return 'Too many sync requests. Try again in a moment.';
    default: return 'Family sync is unavailable right now.';
  }
}

export class FamilyApi {
  constructor(private readonly url: string, private readonly send: Fetch) {}

  private async request(path: string, method: string, code?: string, body?: JsonObject,
    keepalive = false, conflict = false): Promise<{ status: number; json: JsonObject }> {
    const headers: Record<string, string> = {};
    if (code) headers.Authorization = `Family ${code}`;
    if (body) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await this.send(`${this.url.replace(/\/+$/, '')}/v1/family${path}`, {
        method, headers, body: body && JSON.stringify(body), keepalive, cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer',
        signal: keepalive ? undefined : AbortSignal.timeout?.(15_000),
      });
    } catch {
      throw new SyncError('Could not reach family sync.');
    }
    if (!response.ok && !(conflict && response.status === 409)) throw new SyncError(httpMessage(response.status), response.status);
    if (method === 'DELETE') return { status: response.status, json: {} };
    const json: unknown = await response.json().catch(() => null);
    if (!object(json)) throw new SyncError('The server sent unreadable sync data.');
    return { status: response.status, json };
  }

  async create(): Promise<unknown> { return (await this.request('', 'POST')).json.code; }
  async pull(code: string, since?: number): Promise<{ profiles: unknown[]; serverTime: number }> {
    const { json } = await this.request(since === undefined ? '' : `?since=${since}`, 'GET', code);
    if (!Array.isArray(json.profiles) || !stamp(json.serverTime)) throw new SyncError('The server sent an unreadable profile list.');
    return { profiles: json.profiles, serverTime: json.serverTime };
  }

  async put(code: string, id: string, body: JsonObject, keepalive: boolean): Promise<
    { rev: number; updatedAt: number } | { current: unknown }
  > {
    const { json, status } = await this.request(`/profile/${encodeURIComponent(id)}`, 'PUT', code, body, keepalive, true);
    if (status === 409) return { current: json.current };
    if (!stamp(json.rev) || json.rev === 0 || !stamp(json.updatedAt)) throw new SyncError('The server sent an unreadable save receipt.');
    return { rev: json.rev, updatedAt: json.updatedAt };
  }

  async delete(code: string): Promise<void> { await this.request('', 'DELETE', code); }
}
