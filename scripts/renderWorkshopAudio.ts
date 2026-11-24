/**
 * `npm run audio:workshop`: renders every Adventure Workshop sound with the offline synthesis code in
 * apps/workshop/audio/synth (muted headless Edge on the dev scene apps/workshop/dev/AudioRenderWorkshop.ts), encodes Ogg Opus
 * with ffmpeg into public/audio/workshop/ plus manifest.json (lengths, loop info, source hash).
 *
 * Needs: ffmpeg on PATH, Microsoft Edge (Playwright channel 'msedge'). Starts a private Vite server by default;
 * set WORKSHOP_AUDIO_RENDER_PORT to change its port, or WORKSHOP_AUDIO_RENDER_URL to reuse an existing server.
 * WORKSHOP_AUDIO_RENDER_SCOPE=music refreshes music and stings using the already-rendered SFX.
 * Use a full render if the SFX sources also changed.
 */
import { chromium, type Browser } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { repeatSamples, wsAudioKey, type WsAudioEntry, type WsAudioManifest } from '../apps/workshop/audio/manifest';
import type { RenderJob, RenderResult, WsRenderApi } from '../apps/workshop/audio/synth/render';
import { workshopAudioSourceHash } from './workshopAudioHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio', 'workshop');
const DEFAULT_PORT = 5193;
const MUSIC_KBPS = 88;
const STING_KBPS = 72;
const SFX_KBPS = 40;
/** Loops are encoded as this many back-to-back copies; the runtime uses the middle one (no codec edge artifacts at the seam). */
const SFX_LOOP_COPIES = 3;
const CHUNK_SAMPLES = 1 << 20;

function wavFloat32(channels: Float32Array[], sampleRate: number): Buffer {
  const n = channels[0].length;
  const ch = channels.length;
  const dataBytes = n * ch * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * ch * 4, 28); buf.writeUInt16LE(ch * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { buf.writeFloatLE(channels[c][i], o); o += 4; }
  return buf;
}

function dirSize(dir: string): number {
  let t = 0;
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    t += n.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return t;
}

type W = { __wsAudioRender: WsRenderApi };

async function main(): Promise<void> {
  const t0 = Date.now();
  const sourceHash = workshopAudioSourceHash();
  const port = Number(process.env.WORKSHOP_AUDIO_RENDER_PORT ?? DEFAULT_PORT);
  const musicOnly = process.env.WORKSHOP_AUDIO_RENDER_SCOPE === 'music';
  const manifestPath = join(outDir, 'manifest.json');
  const prior: WsAudioManifest | undefined = musicOnly ? JSON.parse(readFileSync(manifestPath, 'utf8')) : undefined;
  const tmp = mkdtempSync(join(process.env.AUDIO_TMP ?? tmpdir(), 'workshop-audio-'));
  const rendered = join(tmp, 'rendered');
  let vite: ViteDevServer | undefined;
  let browser: Browser | undefined;
  try {
    const renderUrl = process.env.WORKSHOP_AUDIO_RENDER_URL ?? `http://localhost:${port}`;
    if (!process.env.WORKSHOP_AUDIO_RENDER_URL) {
      vite = await createServer({
        root, configLoader: 'native', cacheDir: join(tmp, 'vite'), logLevel: 'silent',
        server: { port, strictPort: true, watch: null, hmr: false },
      });
      await vite.listen();
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(`${renderUrl.replace(/\/$/, '')}/workshop.html?dev=AudioRenderWorkshop`);
    await page.waitForFunction(() => '__wsAudioRender' in window, null, { timeout: 90000 });
    const allJobs = await page.evaluate(() => (window as unknown as W).__wsAudioRender.jobs());
    const jobs = musicOnly ? allJobs.filter((job) => job.kind !== 'sfx') : allJobs;

    for (const d of ['music', 'sting', 'sfx']) mkdirSync(join(rendered, d), { recursive: true });
    const manifest: WsAudioManifest = { version: 1, sourceHash, files: {} };

    for (const job of jobs as RenderJob[]) {
      const tj = Date.now();
      const r = await page.evaluate((j) => (window as unknown as W).__wsAudioRender.render(j), job) as RenderResult;
      const id = `${r.kind}:${r.name}`;
      const chans: Float32Array[] = [];
      for (let c = 0; c < r.channels; c++) {
        const out = new Float32Array(r.length);
        for (let s = 0; s < r.length; s += CHUNK_SAMPLES) {
          const n = Math.min(CHUNK_SAMPLES, r.length - s);
          const b64 = await page.evaluate(([i, ch, st, cnt]) => (window as unknown as W).__wsAudioRender.chunk(i as string, ch as number, st as number, cnt as number), [id, c, s, n] as const);
          const bytes = Buffer.from(b64, 'base64');
          out.set(new Float32Array(bytes.buffer, bytes.byteOffset, n), s);
        }
        chans.push(out);
      }
      await page.evaluate((i) => (window as unknown as W).__wsAudioRender.release(i), id);

      const copies = r.kind === 'sfx' && r.loop ? SFX_LOOP_COPIES : 1;
      const encoded = copies > 1 ? chans.map((c) => repeatSamples(c, copies)) : chans;
      const rel = `${r.kind}/${r.name}.ogg`;
      const wav = join(tmp, `${r.kind}-${r.name}.wav`);
      writeFileSync(wav, wavFloat32(encoded, r.sampleRate));
      const kbps = r.kind === 'music' ? MUSIC_KBPS : r.kind === 'sting' ? STING_KBPS : SFX_KBPS;
      const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ar', '48000', '-c:a', 'libopus', '-b:a', `${kbps}k`, '-vbr', 'on', '-application', 'audio', join(rendered, rel)], { stdio: 'inherit' });
      if (ff.status !== 0) throw new Error(`ffmpeg failed for ${id}`);
      rmSync(wav);

      const entry: WsAudioEntry = {
        file: rel, kind: r.kind, sampleRate: r.sampleRate, length: r.length, channels: r.channels as 1 | 2,
        copies, loop: r.loop, seconds: r.seconds,
        ...(r.bpm ? { bpm: r.bpm, lengthBeats: r.lengthBeats } : {}),
      };
      manifest.files[wsAudioKey(r.kind, r.name)] = entry;
      console.log(`${r.kind.padEnd(6)} ${r.name.padEnd(10)} ${r.seconds.toFixed(2)}s  ${(statSync(join(rendered, rel)).size / 1024).toFixed(1)} KB  ${Date.now() - tj} ms`);
    }
    if (workshopAudioSourceHash() !== sourceHash) throw new Error('Audio sources changed during render. Run audio:workshop again.');
    if (prior) {
      for (const [key, entry] of Object.entries(prior.files)) {
        if (entry.kind === 'sfx') manifest.files[key] = entry;
      }
      for (const dir of ['music', 'sting']) cpSync(join(rendered, dir), join(outDir, dir), { recursive: true });
    } else {
      rmSync(outDir, { recursive: true, force: true });
      cpSync(rendered, outDir, { recursive: true });
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
    console.log(`workshop audio: ${jobs.length} files, ${(dirSize(outDir) / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s, hash ${sourceHash}`);
  } finally {
    await browser?.close().catch(() => {});
    await vite?.close().catch(() => {});
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
