import { normalizeFamilyCode } from './code';
import { object, profileId, stamp, type Fetch } from './protocol';

interface Row { id: string; rev: number; updatedAt: number; deleted?: boolean; data: unknown }
interface FakeState {
  time: number;
  families: Record<string, Record<string, Row>>;
}

/** In-page dev server. Tests can also share the same instance across isolated browser contexts. */
export class FakeFamilyServer {
  private readonly state: FakeState;
  constructor(saved?: FakeState, private readonly persist?: (state: FakeState) => void) {
    this.state = saved ?? { time: Date.now(), families: {} };
  }

  readonly fetch: Fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const reply = (status: number, body: object = {}) =>
      Response.json({ ...body, serverTime: this.state.time }, { status });
    const tick = () => this.state.time = Math.max(Date.now(), this.state.time + 1);
    const put = (family: Record<string, Row>, id: string, data: unknown, deleted?: boolean) => {
      const row = { id, rev: (family[id]?.rev ?? 0) + 1, updatedAt: tick(), data, deleted };
      family[id] = row;
      this.persist?.(this.state);
      return reply(200, { rev: row.rev, updatedAt: row.updatedAt });
    };

    if (url.pathname === '/v1/family' && req.method === 'POST') {
      let n = 1;
      let code: string;
      do { code = `TIGER-MAPLE-SOCK-${String(n++).padStart(2, '0')}`; }
      while (n <= 100 && this.state.families[code]);
      if (this.state.families[code]) return reply(429);
      this.state.families[code] = {};
      tick();
      this.persist?.(this.state);
      return reply(201, { code });
    }
    const auth = req.headers.get('Authorization');
    const code = auth?.startsWith('Family ') ? normalizeFamilyCode(auth.slice(7)) : null;
    const family = code ? this.state.families[code] : undefined;
    if (!code || !family) return reply(401);
    if (url.pathname === '/v1/family') {
      if (req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? 0);
        return reply(200, { profiles: Object.values(family).filter(row => row.updatedAt > since) });
      }
      if (req.method === 'DELETE') {
        delete this.state.families[code];
        tick();
        this.persist?.(this.state);
        return reply(200);
      }
    }
    const id = url.pathname.match(/^\/v1\/family\/profile\/([^/]+)$/)?.[1];
    if (!profileId(id)) return reply(404);
    if (req.method === 'DELETE') return put(family, id, null, true);
    if (req.method !== 'PUT') return reply(405);
    const raw: unknown = await req.json().catch(() => null);
    if (!object(raw) || !stamp(raw.baseRev) || !Object.hasOwn(raw, 'data')
      || (raw.deleted !== undefined && typeof raw.deleted !== 'boolean')) return reply(400);
    if (new TextEncoder().encode(JSON.stringify(raw.data)).length > 256 * 1024) return reply(413);
    const current = family[id];
    if (raw.baseRev !== (current?.rev ?? 0)) return reply(409, { current: current ?? null });
    if (!current && Object.keys(family).length >= 20) return reply(413);
    return put(family, id, raw.data, raw.deleted);
  };
}
