/**
 * `npm run audio:render`: renders every sound with the game's own offline synthesis code (in a muted headless Edge
 * running the dev scene src/scenes/dev/AudioRender.ts), then encodes Ogg Opus with ffmpeg into public/audio/
 * plus public/audio/manifest.json (exact source lengths, loop info, source hash). Re-run after changing sounds or music.
 *
 * Needs: ffmpeg on PATH, Microsoft Edge (Playwright channel 'msedge'). Dev server on port 5186. Temp WAVs go to
 * $AUDIO_TMP or the OS temp dir.
 */
import { chromium, type Browser } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { repeatSamples, type AudioFileEntry, type AudioManifest, type MusicFileEntry } from '../src/audio/audioManifest';
import { applyMusicGain, musicNormalizationGain } from '../src/audio/musicLoudness';
import type { AudioRenderApi, RenderJob, RenderResult } from '../src/scenes/dev/AudioRender';
import { audioSourceHash } from './audioSourceHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio');
const PORT = 5186;
const MUSIC_KBPS = 96;
const SFX_KBPS = 64;
/** Short loops are encoded as this many back-to-back copies; the runtime uses the middle one (no codec edge artifacts at the seam). */
const LOOP_COPIES = 3;
const CHUNK_SAMPLES = 1 << 20;

type Api = AudioRenderApi;

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

function measureEncodedMusic(file: string): Pick<MusicFileEntry, 'meanDb' | 'peakDb'> {
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const mean = ff.stderr?.match(/mean_volume:\s+(-?[\d.]+) dB/);
  const peak = ff.stderr?.match(/max_volume:\s+(-?[\d.]+) dB/);
  if (ff.status !== 0 || !mean || !peak) throw new Error(`Could not measure ${file}: ${ff.stderr ?? ff.error}`);
  return { meanDb: Number(mean[1]), peakDb: Number(peak[1]) };
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const sourceHash = audioSourceHash();
  const tmp = mkdtempSync(join(process.env.AUDIO_TMP ?? tmpdir(), 'brainracer-audio-'));
  const rendered = join(tmp, 'rendered');
  let vite: ViteDevServer | undefined;
  let browser: Browser | undefined;
  try {
    // Build jobs must survive file writes in other checkouts and their own asset output.
    vite = await createServer({
      root, cacheDir: join(tmp, 'vite'), logLevel: 'silent',
      server: { port: PORT, strictPort: true, watch: null, hmr: false },
    });
    await vite.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(`http://localhost:${PORT}/?dev=AudioRender`);
    await page.waitForFunction(() => '__audioRender' in window, null, { timeout: 60000 });
    const jobs = await page.evaluate(() => (window as unknown as { __audioRender: Api }).__audioRender.jobs());

    mkdirSync(join(rendered, 'sfx'), { recursive: true });
    mkdirSync(join(rendered, 'music'), { recursive: true });
    const manifest: AudioManifest = { version: 1, sourceHash, sfx: {}, loops: {}, engine: null as unknown as AudioFileEntry, music: {} };
    const musicGains: Record<string, number> = {};

    for (const job of jobs as RenderJob[]) {
      const tj = Date.now();
      const r = await page.evaluate((j) => (window as unknown as { __audioRender: Api }).__audioRender.render(j), job) as RenderResult;
      const chans: Float32Array[] = [];
      for (let c = 0; c < r.channels; c++) {
        const out = new Float32Array(r.length);
        for (let s = 0; s < r.length; s += CHUNK_SAMPLES) {
          const n = Math.min(CHUNK_SAMPLES, r.length - s);
          const b64 = await page.evaluate(([id, ch, st, cnt]) => (window as unknown as { __audioRender: Api }).__audioRender.chunk(id as string, ch as number, st as number, cnt as number), [r.id, c, s, n] as const);
          const bytes = Buffer.from(b64, 'base64');
          out.set(new Float32Array(bytes.buffer, bytes.byteOffset, n), s);
        }
        chans.push(out);
      }
      await page.evaluate((id) => (window as unknown as { __audioRender: Api }).__audioRender.release(id), r.id);

      if (r.kind === 'music') {
        const gain = musicNormalizationGain(chans);
        applyMusicGain(chans, gain);
        musicGains[r.id] = gain;
      }
      const isLoopFile = r.kind === 'loop' || r.kind === 'engine';
      const copies = isLoopFile ? LOOP_COPIES : 1;
      const encoded = copies > 1 ? chans.map((c) => repeatSamples(c, copies)) : chans;
      const rel = r.kind === 'music' ? `music/${r.id}.ogg` : r.kind === 'sfx' ? `sfx/${r.id}.ogg` : `sfx/loop-${r.id}.ogg`;
      const wav = join(tmp, `${r.kind}-${r.id}.wav`);
      writeFileSync(wav, wavFloat32(encoded, r.sampleRate));
      const kbps = r.kind === 'music' ? MUSIC_KBPS : SFX_KBPS;
      const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ar', '48000', '-c:a', 'libopus', '-b:a', `${kbps}k`, '-vbr', 'on', '-application', 'audio', join(rendered, rel)], { stdio: 'inherit' });
      if (ff.status !== 0) throw new Error(`ffmpeg failed for ${r.id}`);
      rmSync(wav);

      const entry: AudioFileEntry = { file: rel, sampleRate: r.sampleRate, length: r.length, channels: r.channels as 1 | 2, copies, loop: r.loop };
      if (r.kind === 'music') {
        manifest.music[r.id] = {
          ...entry, bpm: r.bpm!, lengthBeats: r.lengthBeats!, loopSeconds: r.loopSeconds!,
          ...measureEncodedMusic(join(rendered, rel)),
        };
      }
      else if (r.kind === 'sfx') manifest.sfx[r.id] = entry;
      else if (r.kind === 'engine') manifest.engine = entry;
      else manifest.loops[r.id] = entry;
      console.log(`${r.kind.padEnd(6)} ${r.id.padEnd(12)} ${(r.length / r.sampleRate).toFixed(2)}s  ${(statSync(join(rendered, rel)).size / 1024).toFixed(1)} KB  ${Date.now() - tj} ms`);
    }
    if (audioSourceHash() !== sourceHash) throw new Error('Audio sources changed during render. Run audio:render again.');
    cpSync(rendered, outDir, { recursive: true });
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
    writeFileSync(join(root, 'src', 'audio', 'musicGains.json'), JSON.stringify(musicGains, null, 2) + '\n');
    console.log(`audio: ${jobs.length} files, ${(dirSize(outDir) / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s, hash ${sourceHash}`);
  } finally {
    await browser?.close().catch(() => {});
    await vite?.close().catch(() => {});
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
