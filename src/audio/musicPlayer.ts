import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { MusicTrack } from '../core/types';
import type { Mixer } from './mixer';
import { foldTail, loopOffsetSec, planChunks, renderQueue } from './bufferUtils';
import {
  beatsToSeconds, drumKind, looksLikeMidi, midiToFreq, midiToTrack, secondsToBeats, validateTrack,
  type TrackData, type TrackLayer,
} from './musicTheory';
import title from './music/tracks/title.json';
import race from './music/tracks/race.json';
import industrial from './music/tracks/industrial.json';
import dino from './music/tracks/dino.json';
import farm from './music/tracks/farm.json';
import underground from './music/tracks/underground.json';
import results from './music/tracks/results.json';

/** Optional MIDI overrides: drop <track>.mid files into src/audio/music/midi/ (resolved at build time). */
const MIDI_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./music/midi/*.mid', { query: '?url', import: 'default', eager: true }))
    .map(([f, url]) => [f.replace(/^.*\/(.+)\.mid$/, '$1'), url]),
);

const BUILTIN: Record<MusicTrack, TrackData> = {
  title: title as TrackData,
  race: race as TrackData,
  industrial: industrial as TrackData,
  farm: farm as TrackData,
  underground: underground as TrackData,
  dino: dino as TrackData,
  results: results as TrackData,
};

const LOOKAHEAD_SEC = 0.25;
/** Pre-rendered music: rate, and the ring-out rendered past the loop end (folded back onto the start). */
const MUSIC_SR = 32000;
const LOOP_TAIL_SEC = 1;
/** Offline render window and the longest lead-in rendered before it. */
const CHUNK_SEC = 4;
const MAX_LEAD_SEC = 4.5;
const ONESHOT_TAIL_SEC = 2.5;
const SWAP_FADE_SEC = 0.3;
/** Background render order: title first, then the race tracks. */
const RENDER_ORDER: MusicTrack[] = ['title', 'race', 'farm', 'industrial', 'dino', 'underground', 'results'];
const TICK_SEC = 0.1;

type NoteFn = (note: { p: number; d: number; v: number }, time: number) => void;

interface LayerRuntime {
  notes: { t: number; d: number; p: number; v: number }[]; // sorted by t
  play: NoteFn;
}

/** Builds every layer's instruments into `dest` (shared by live playback and offline rendering). */
function buildLayers(data: TrackData, dest: Tone.InputNode, nodes: Tone.ToneAudioNode[]): LayerRuntime[] {
  return data.tracks.map((layer) => buildLayer(layer, dest, nodes));
}

function buildLayer(layer: TrackLayer, dest: Tone.InputNode, nodes: Tone.ToneAudioNode[]): LayerRuntime {
  const notes = [...layer.notes].sort((a, b) => a.t - b.t);
  const lvl = new Tone.Gain(Math.max(0, layer.volume) * 0.32).connect(dest);
  nodes.push(lvl);
  const env = { attack: 0.005, decay: 0.06, sustain: 0.6, release: 0.06 };
  switch (layer.instrument) {
    case 'noise':
      return { notes, play: buildDrums(lvl, nodes) };
    case 'pluck': {
      // banjo-like: bright saw/pulse blend with a fast decay, through a lowpass that closes quickly
      const lp = new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 1.2 });
      lp.connect(lvl);
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'pulse', width: 0.3 },
        envelope: { attack: 0.002, decay: 0.22, sustain: 0.04, release: 0.08 },
      } as never);
      synth.maxPolyphony = 12;
      synth.connect(lp);
      nodes.push(lp, synth);
      return {
        notes,
        play: (n, time) => synth.triggerAttackRelease(midiToFreq(n.p), Math.min(0.35, Math.max(0.03, n.d)), time, n.v),
      };
    }
    case 'pulse25':
    case 'square':
    case 'triangle':
    case 'sawtooth': {
      const osc =
        layer.instrument === 'pulse25' ? { type: 'pulse', width: 0.25 }
          : layer.instrument === 'sawtooth' ? { type: 'sawtooth' }
            : { type: layer.instrument };
      const sustain = layer.instrument === 'triangle' ? 0.9 : layer.instrument === 'sawtooth' ? 0.5 : 0.6;
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: osc,
        envelope: { ...env, sustain },
      } as never);
      synth.maxPolyphony = 12;
      synth.connect(lvl);
      nodes.push(synth);
      return {
        notes,
        play: (n, time) => synth.triggerAttackRelease(midiToFreq(n.p), Math.max(0.03, n.d), time, n.v),
      };
    }
  }
}

function buildDrums(dest: Tone.InputNode, nodes: Tone.ToneAudioNode[]): NoteFn {
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 } }).connect(dest);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.03 } });
  const snareGain = new Tone.Gain(0.55).connect(dest);
  snare.connect(snareGain);
  const hatFilter = new Tone.Filter({ type: 'highpass', frequency: 7000 }).connect(dest);
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 } });
  const hatGain = new Tone.Gain(0.3).connect(hatFilter);
  hat.connect(hatGain);
  nodes.push(kick, snare, snareGain, hatFilter, hat, hatGain);
  const last = { kick: -1, snare: -1, hat: -1 };
  return (n, time) => {
    const k = drumKind(n.p);
    if (time <= last[k] + 0.002) return; // monophonic voices need strictly increasing times
    last[k] = time;
    if (k === 'kick') kick.triggerAttackRelease(48, 0.15, time, n.v);
    else if (k === 'snare') snare.triggerAttackRelease(0.1, time, n.v);
    else hat.triggerAttackRelease(0.03, time, n.v);
  };
}


/** Common surface of a running track (live synth or pre-rendered buffer). */
interface Running {
  readonly data: TrackData;
  readonly isBuffer: boolean;
  phaseBeats(): number;
  /** Phase at the moment the speakers are playing (ignores the Tone look-ahead). */
  phaseAudible(): number;
  readonly finished: boolean;
  fadeOutAndDispose(sec: number): void;
  dispose(): void;
}

/** One running track: its own gain (for fades), synths and a Transport-driven look-ahead scheduler. */
class Playback implements Running {
  readonly isBuffer = false;
  private readonly nodes: Tone.ToneAudioNode[] = [];
  private readonly layers: LayerRuntime[] = [];
  private readonly gain: Tone.Gain;
  private readonly eventId: number;
  private readonly startAudio: number;
  private readonly startBeat: number;
  private cursor: number; // absolute beats (since startBeat origin) already scheduled up to
  private disposed = false;

  constructor(readonly data: TrackData, mixer: Mixer, startPhaseBeats: number, fadeInSec: number) {
    this.gain = new Tone.Gain(fadeInSec > 0 ? 0 : 1).connect(mixer.musicBus);
    this.nodes.push(this.gain);
    if (fadeInSec > 0) this.gain.gain.rampTo(1, fadeInSec);
    this.layers.push(...buildLayers(data, this.gain, this.nodes));
    this.startAudio = Tone.now() + 0.08;
    this.startBeat = startPhaseBeats;
    this.cursor = startPhaseBeats;
    this.eventId = Tone.getTransport().scheduleRepeat((time) => this.tick(time), TICK_SEC);
  }

  /** Current position within the loop, in beats. */
  phaseBeats(): number {
    const b = this.startBeat + secondsToBeats(Math.max(0, Tone.now() - this.startAudio), this.data.bpm);
    return this.data.loop ? b % this.data.lengthBeats : b;
  }

  phaseAudible(): number {
    const b = this.startBeat + secondsToBeats(Math.max(0, Tone.getContext().currentTime - this.startAudio), this.data.bpm);
    return this.data.loop ? b % this.data.lengthBeats : b;
  }

  get finished(): boolean {
    return !this.data.loop && this.cursor >= this.data.lengthBeats;
  }

  private tick(time: number): void {
    if (this.disposed) return;
    const bpm = this.data.bpm;
    const target = this.startBeat + secondsToBeats(time + LOOKAHEAD_SEC - this.startAudio, bpm);
    if (target <= this.cursor) return;
    const len = this.data.lengthBeats;
    const from = this.cursor;
    const lastLoop = this.data.loop ? Math.floor(target / len) : 0;
    for (let loopIdx = Math.floor(from / len); loopIdx <= lastLoop; loopIdx++) {
      const base = loopIdx * len;
      for (const layer of this.layers) {
        for (const n of layer.notes) {
          const abs = base + n.t;
          if (abs < from) continue;
          if (abs >= target) break;
          const when = Math.max(Tone.now(), this.startAudio + beatsToSeconds(abs - this.startBeat, bpm));
          try { layer.play(n, when); } catch { /* skip a bad note */ }
        }
      }
      if (!this.data.loop) break;
    }
    this.cursor = this.data.loop ? target : Math.min(target, len + 0.001);
    if (!this.data.loop && target >= len) {
      // one-shot finished scheduling: dispose once the tail has rung out
      Tone.getTransport().clear(this.eventId);
      const tail = 2.5;
      window.setTimeout(() => this.dispose(), tail * 1000);
    }
  }

  fadeOutAndDispose(sec: number): void {
    if (this.disposed) return;
    Tone.getTransport().clear(this.eventId);
    const now = Tone.now();
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.02, sec));
    window.setTimeout(() => this.dispose(), (sec + 0.4) * 1000);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    Tone.getTransport().clear(this.eventId);
    for (const n of this.nodes) {
      try { n.dispose(); } catch { /* ignore */ }
    }
    this.nodes.length = 0;
  }
}

/** Longest sound a note can make (its duration plus a generous release), in seconds. */
function maxNoteSec(data: TrackData): number {
  let m = 0;
  for (const layer of data.tracks) for (const n of layer.notes) m = Math.max(m, n.d);
  return m + 0.5;
}

/**
 * Renders a track (one loop plus its ring-out, folded back onto the start) into a stereo buffer.
 * Done in short windows (each with a lead-in so notes that started earlier are still ringing): one long
 * OfflineAudioContext with every note scheduled up front is several times slower.
 */
async function renderTrackBuffer(data: TrackData, chunkSec = CHUNK_SEC): Promise<AudioBuffer> {
  const sec = beatsToSeconds(data.lengthBeats, data.bpm);
  const total = Math.ceil((sec + (data.loop ? LOOP_TAIL_SEC : ONESHOT_TAIL_SEC)) * MUSIC_SR);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const lead = Math.ceil(Math.min(MAX_LEAD_SEC, maxNoteSec(data)) * MUSIC_SR);
  for (const chunk of planChunks(total, Math.round(chunkSec * MUSIC_SR), lead)) {
    const winSec = chunk.winStart / MUSIC_SR;
    const endSec = chunk.end / MUSIC_SR;
    const n = chunk.end - chunk.winStart;
    const rendered = await Tone.Offline(() => {
      const out = new Tone.Gain(1).toDestination();
      const layers = buildLayers(data, out, []);
      for (const layer of layers) {
        for (const note of layer.notes) {
          const t = beatsToSeconds(note.t, data.bpm);
          if (t < winSec - 1e-9) continue;
          if (t >= endSec - 1e-9) break;
          try { layer.play(note, t - winSec); } catch { /* skip a bad note */ }
        }
      }
    }, (n + 0.5) / MUSIC_SR, 2, MUSIC_SR);
    const skip = chunk.start - chunk.winStart;
    left.set(rendered.getChannelData(0).subarray(skip, n), chunk.start);
    right.set(rendered.getChannelData(1).subarray(skip, n), chunk.start);
  }
  const len = data.loop ? Math.round(sec * MUSIC_SR) : total;
  const buf = Tone.getContext().createBuffer(2, len, MUSIC_SR) as AudioBuffer;
  buf.getChannelData(0).set(data.loop ? foldTail(left, len) : left);
  buf.getChannelData(1).set(data.loop ? foldTail(right, len) : right);
  return buf;
}

/** A pre-rendered track: one looping (or one-shot) AudioBufferSourceNode -> gain -> music bus. */
class BufferPlayback implements Running {
  readonly isBuffer = true;
  private readonly ctx = Tone.getContext();
  private readonly src: AudioBufferSourceNode;
  private readonly gain: GainNode;
  private readonly startRaw: number;
  private readonly startBeat: number;
  private disposed = false;

  constructor(readonly data: TrackData, buf: AudioBuffer, mixer: Mixer, startPhaseBeats: number, fadeInSec: number) {
    const c = this.ctx;
    this.gain = c.createGain() as unknown as GainNode;
    this.src = c.createBufferSource() as unknown as AudioBufferSourceNode;
    this.src.buffer = buf;
    this.startRaw = c.currentTime + 0.05;
    this.startBeat = startPhaseBeats;
    this.gain.gain.setValueAtTime(fadeInSec > 0 ? 0 : 1, this.startRaw);
    if (fadeInSec > 0) this.gain.gain.linearRampToValueAtTime(1, this.startRaw + fadeInSec);
    this.src.connect(this.gain);
    Tone.connect(this.gain as never, mixer.musicBus);
    if (data.loop) {
      this.src.loop = true;
      this.src.loopStart = 0;
      this.src.loopEnd = buf.length / buf.sampleRate;
    } else {
      this.src.onended = () => this.dispose();
    }
    const offset = data.loop ? loopOffsetSec(startPhaseBeats, data.bpm, data.lengthBeats) : beatsToSeconds(startPhaseBeats, data.bpm);
    this.src.start(this.startRaw, offset);
  }

  phaseBeats(): number {
    const b = this.startBeat + secondsToBeats(Math.max(0, this.ctx.currentTime - this.startRaw), this.data.bpm);
    return this.data.loop ? b % this.data.lengthBeats : b;
  }
  phaseAudible(): number { return this.phaseBeats(); }

  get finished(): boolean {
    return !this.data.loop && (this.disposed || this.phaseBeats() >= this.data.lengthBeats);
  }

  fadeOutAndDispose(sec: number): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    try {
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.02, sec));
      this.src.stop(now + Math.max(0.02, sec) + 0.05);
    } catch { /* ignore */ }
    window.setTimeout(() => this.dispose(), (sec + 0.4) * 1000);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.src.onended = null;
    try { this.src.stop(); } catch { /* not started / already stopped */ }
    for (const n of [this.src, this.gain]) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
  }
}

export class MusicPlayer {
  private current: Running | null = null;
  private currentName: MusicTrack | null = null;
  private industrialPhase = 0;
  private token = 0;
  private readonly overrides = new Map<MusicTrack, Promise<TrackData | null>>();
  private prerendered = false;
  private readonly cache = new Map<MusicTrack, AudioBuffer>();
  private readonly inflight = new Map<MusicTrack, Promise<AudioBuffer | null>>();
  private readonly renderMs = new Map<MusicTrack, number>();
  private background: Promise<void> | null = null;
  private logged = false;

  /** Tracks with a rendered buffer / total tracks (diagnostics). */
  get cachedCount(): number { return this.cache.size; }
  static readonly TRACK_COUNT = RENDER_ORDER.length;

  /** Pre-rendered mode on/off. On: render every track in the background and swap the current one when ready. Off: back to live synths. */
  setPrerendered(on: boolean): void {
    if (on === this.prerendered) return;
    this.prerendered = on;
    if (on) void this.renderBackground();
    this.swapCurrent();
  }

  /** Renders the whole track list sequentially (title first). Idempotent. */
  renderBackground(): Promise<void> {
    this.background ??= (async () => {
      for (const name of RENDER_ORDER) {
        if (!this.prerendered) break;
        await this.render(name, 5);
      }
      this.background = null;
    })();
    return this.background;
  }

  private render(name: MusicTrack, priority: number): Promise<AudioBuffer | null> {
    const hit = this.cache.get(name);
    if (hit) return Promise.resolve(hit);
    let p = this.inflight.get(name);
    if (p) return p;
    p = renderQueue.add(priority, async () => {
      const data = await this.resolve(name);
      const t0 = performance.now();
      const buf = await renderTrackBuffer(data);
      this.renderMs.set(name, Math.round(performance.now() - t0));
      this.cache.set(name, buf);
      return buf;
    }).catch(() => null).then((buf) => {
      this.inflight.delete(name);
      if (buf) {
        if (this.prerendered && this.currentName === name) this.swapCurrent();
        this.logTimes();
      }
      return buf;
    });
    this.inflight.set(name, p);
    return p;
  }

  private logTimes(): void {
    if (this.logged || this.cache.size < RENDER_ORDER.length) return;
    this.logged = true;
    const total = [...this.renderMs.values()].reduce((a, b) => a + b, 0);
    console.info(`[audio] pre-rendered music (ms): ${[...this.renderMs].map(([k, v]) => `${k} ${v}`).join(', ')}; total ${total}`);
  }

  /** The current track is playing the wrong kind (live vs buffer) for the mode: crossfade to the right one at the same phase. */
  private swapCurrent(): void {
    const old = this.current;
    const name = this.currentName;
    if (!old || !name || !old.data.loop || old.finished) return;
    const wantBuffer = this.prerendered && this.cache.has(name);
    if (wantBuffer === old.isBuffer) return;
    this.current = this.make(name, old.data, old.phaseAudible(), SWAP_FADE_SEC);
    old.fadeOutAndDispose(SWAP_FADE_SEC);
  }

  /** Starts a playback for the track: from its buffer when pre-rendered mode has one, otherwise the live synths. */
  private make(name: MusicTrack, data: TrackData, phase: number, fadeIn: number): Running {
    const buf = this.prerendered ? this.cache.get(name) : undefined;
    if (buf) return new BufferPlayback(data, buf, this.mixer, phase, fadeIn);
    const t = Tone.getTransport();
    if (t.state !== 'started') t.start();
    return new Playback(data, this.mixer, phase, fadeIn);
  }

  constructor(private readonly mixer: Mixer) {}

  play(name: MusicTrack | null, crossfadeSec = 1): void {
    const my = ++this.token;
    if (name === null) {
      this.currentName = null;
      this.industrialPhase = 0;
      this.stopCurrent(crossfadeSec);
      return;
    }
    if (name === this.currentName && this.current && !this.current.finished) return;
    void this.resolve(name).then((data) => {
      if (my !== this.token) return; // superseded by a newer call
      this.start(name, data, crossfadeSec);
    }).catch(() => { /* silent */ });
  }

  private start(name: MusicTrack, data: TrackData, fade: number): void {
    const old = this.current;
    let phase = 0;
    const toBuffer = this.prerendered && this.cache.has(name);
    // phaseAudible() (no look-ahead) when a buffer is involved; the live-to-live path keeps phaseBeats() as before
    const oldPhase = (o: Running): number => (toBuffer || o.isBuffer ? o.phaseAudible() : o.phaseBeats());
    const sameClock = old && old.data.loop && data.loop && old.data.bpm === data.bpm && old.data.lengthBeats === data.lengthBeats;
    if (sameClock && old) phase = oldPhase(old);
    if (name === 'industrial' && this.currentName === 'dino') phase = this.industrialPhase;

    // Save the race position for this interruption only. A new race starts at beat zero.
    this.industrialPhase = name === 'dino' && this.currentName === 'industrial' && old
      ? oldPhase(old)
      : 0;
    this.current = this.make(name, data, phase, old ? fade : Math.min(fade, 0.3));
    this.currentName = name;
    if (this.prerendered && !toBuffer) void this.render(name, 0); // live now, swaps to the buffer when it is ready
    if (old) old.fadeOutAndDispose(fade);
  }

  private stopCurrent(fade: number): void {
    if (this.current) this.current.fadeOutAndDispose(fade);
    this.current = null;
  }

  /** Optional `src/audio/music/midi/<track>.mid` override (fetched once; 404 / non-MIDI tolerated). */
  private resolve(name: MusicTrack): Promise<TrackData> {
    let p = this.overrides.get(name);
    if (!p) {
      p = this.fetchMidi(name);
      this.overrides.set(name, p);
    }
    return p.then((d) => d ?? BUILTIN[name]);
  }

  private async fetchMidi(name: MusicTrack): Promise<TrackData | null> {
    // Only fetch files that existed at build time (avoids a console 404 per track).
    const url = MIDI_URLS[name];
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (!looksLikeMidi(new Uint8Array(buf))) return null;
      const data = midiToTrack(new Midi(buf), name, name !== 'results');
      return validateTrack(data).length === 0 ? data : null;
    } catch {
      return null;
    }
  }
}
