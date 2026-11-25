import { D1SyncStore } from './d1Store';
import type { D1Database } from './d1Store';
import { handleRequest } from './handler';

interface Env {
  SYNC_DB: D1Database;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, new D1SyncStore(env.SYNC_DB));
  },
};
