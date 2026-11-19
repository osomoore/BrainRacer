import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { MusicTrack } from '../core/types';
import type { Mixer } from './mixer';
import {
  beatsToSeconds, drumKind, looksLikeMidi, midiToFreq, midiToTrack, secondsToBeats, validateTrack,
  type TrackData, type TrackLayer,
} from './musicTheory';
import title from './music/tracks/title.json';
import race from './music/tracks/race.json';
import industrial from './music/tracks/industrial.json';
import dino from './music/tracks/dino.json';
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
  farm: race as TrackData, // placeholder until the farm track lands
  dino: dino as TrackData,
  results: results as TrackData,
};

const LOOKAHEAD_SEC = 0.25;
const TICK_SEC = 0.1;

type NoteFn = (note: { p: number; d: number; v: number }, time: number) => void;

interface LayerRuntime {
  notes: { t: number; d: number; p: number; v: number }[]; // sorted by t
  play: NoteFn;
}

/** One running track: its own gain (for fades), synths and a Transport-driven look-ahead scheduler. */
class Playback {
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
    for (const layer of data.tracks) this.layers.push(this.buildLayer(layer));
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

  get finished(): boolean {
    return !this.data.loop && this.cursor >= this.data.lengthBeats;
  }

  private buildLayer(layer: TrackLayer): LayerRuntime {
    const notes = [...layer.notes].sort((a, b) => a.t - b.t);
    const lvl = new Tone.Gain(Math.max(0, layer.volume) * 0.32).connect(this.gain);
    this.nodes.push(lvl);
    const env = { attack: 0.005, decay: 0.06, sustain: 0.6, release: 0.06 };
    switch (layer.instrument) {
      case 'noise':
        return { notes, play: this.buildDrums(lvl) };
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
        this.nodes.push(synth);
        return {
          notes,
          play: (n, time) => synth.triggerAttackRelease(midiToFreq(n.p), Math.max(0.03, n.d), time, n.v),
        };
      }
    }
  }

  private buildDrums(dest: Tone.InputNode): NoteFn {
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 } }).connect(dest);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.03 } });
    const snareGain = new Tone.Gain(0.55).connect(dest);
    snare.connect(snareGain);
    const hatFilter = new Tone.Filter({ type: 'highpass', frequency: 7000 }).connect(dest);
    const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 } });
    const hatGain = new Tone.Gain(0.3).connect(hatFilter);
    hat.connect(hatGain);
    this.nodes.push(kick, snare, snareGain, hatFilter, hat, hatGain);
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

export class MusicPlayer {
  private current: Playback | null = null;
  private currentName: MusicTrack | null = null;
  private industrialPhase = 0;
  private token = 0;
  private readonly overrides = new Map<MusicTrack, Promise<TrackData | null>>();

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
    const sameClock = old && old.data.loop && data.loop && old.data.bpm === data.bpm && old.data.lengthBeats === data.lengthBeats;
    if (sameClock && old) phase = old.phaseBeats();
    if (name === 'industrial' && this.currentName === 'dino') phase = this.industrialPhase;

    // Save the race position for this interruption only. A new race starts at beat zero.
    this.industrialPhase = name === 'dino' && this.currentName === 'industrial' && old
      ? old.phaseBeats()
      : 0;
    const t = Tone.getTransport();
    if (t.state !== 'started') t.start();
    this.current = new Playback(data, this.mixer, phase, old ? fade : Math.min(fade, 0.3));
    this.currentName = name;
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
