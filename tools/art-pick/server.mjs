// `npm run art:pick`: tiny local server for voting on ComfyUI art candidates (no dependencies).
// Serves tools/art-pick/index.html, art-candidates/ (png + index.json) and reads/writes
// apps/workshop/art/paint/picks.json. See docs/WORKSHOP_ART_PIPELINE.md.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const candDir = join(root, 'art-candidates');
const picksPath = join(root, 'apps', 'workshop', 'art', 'paint', 'picks.json');
const PORT = Number(process.env.ART_PICK_PORT ?? 5203);

const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
function writePicks(picks) {
  const sorted = Object.fromEntries(Object.entries(picks).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const tmp = picksPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(sorted, null, 1) + '\n', 'utf8');
  renameSync(tmp, picksPath);
}

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  if (req.method === 'GET' && (path === '/' || path === '/index.html')) return send(res, 200, readFileSync(join(here, 'index.html')), 'text/html; charset=utf-8');
  if (req.method === 'GET' && path === '/api/index') return send(res, 200, JSON.stringify(readJson(join(candDir, 'index.json'), { version: 1, jobs: {} })));
  if (req.method === 'GET' && path === '/api/picks') return send(res, 200, JSON.stringify(readJson(picksPath, {})));
  if (req.method === 'POST' && path === '/api/pick') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { key, pick, comment } = JSON.parse(body);
        if (typeof key !== 'string') throw new Error('key');
        const picks = readJson(picksPath, {});
        const cm = typeof comment === 'string' && comment.trim() ? comment.trim() : undefined;
        if (pick === null || pick === undefined) { if (cm) picks[key] = { pick: 'pending', comment: cm }; else delete picks[key]; }
        else if (pick === 'shape' || pick === 'more' || Number.isInteger(pick)) picks[key] = cm ? { pick, comment: cm } : { pick };
        else throw new Error('pick');
        writePicks(picks);
        send(res, 200, JSON.stringify(picks));
      } catch (e) { send(res, 400, JSON.stringify({ error: String(e) })); }
    });
    return;
  }
  if (req.method === 'GET' && path.startsWith('/cand/')) {
    const file = normalize(join(candDir, path.slice(6)));
    if (!file.startsWith(candDir + sep) || !file.endsWith('.png') || !existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, readFileSync(file), 'image/png');
  }
  send(res, 404, 'not found', 'text/plain');
});

mkdirSync(candDir, { recursive: true });
server.listen(PORT, '127.0.0.1', () => console.log(`art:pick  http://localhost:${PORT}/   (candidates: ${candDir}, votes: ${picksPath})`));
