import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
await p.goto(process.argv[2]); await p.waitForTimeout(5000);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
await p.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, t] of counts) { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + t); }
const total = [...self.values()].reduce((a, c) => a + c, 0);
console.log([...self.entries()].sort((a, c) => c[1] - a[1]).slice(0, 25).map(([k, t]) => `${(100 * t / total).toFixed(1)}% ${k}`).join('\n'));
await b.close();
