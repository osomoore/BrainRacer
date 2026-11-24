/**
 * Names and the shape of `public/audio/workshop/manifest.json` (written by `npm run audio:workshop`).
 * Pure: no Phaser, no Tone, no DOM. Shared by the runtime player, the render scene and the render script.
 */
import type { WorkshopAudio, WsMusic, WsSfx, WsSting } from '../core/runtime';

export type WsCurrencySfx = 'buy' | 'notEnough' | 'payout';
export type WsAudioSfx = WsSfx | WsCurrencySfx;

/** Play any workshop one-shot through the current narrow shared API. Keep the single compatibility cast here. */
export function playWorkshopSfx(audio: WorkshopAudio, name: WsAudioSfx, opts?: { volume?: number; rate?: number; pan?: number }): void {
  audio.sfx(name as WsSfx, opts);
}

const record = <T extends string>(r: Record<T, true>): T[] => Object.keys(r) as T[];

export const WS_MUSIC_NAMES: readonly WsMusic[] = record<WsMusic>({ raceShop: true, dinoLab: true, title: true, raceRun: true, dinoRun: true });
export const WS_STING_NAMES: readonly WsSting[] = record<WsSting>({ success: true, fail: true, unlock: true });
export const WS_SFX_NAMES: readonly WsAudioSfx[] = record<WsAudioSfx>({
  click: true, select: true, back: true, step: true, whoosh: true, pop: true, sparkle: true,
  engine: true, engineRev: true, skid: true, splat: true, splash: true, spin: true, boing: true, thud: true,
  honk: true, crash: true, quack: true,
  stomp: true, roar: true, chomp: true, gulp: true, burp: true, rustle: true, flap: true, sniff: true,
  giggle: true, wobble: true, cheer: true, sad: true,
  buy: true, notEnough: true, payout: true,
});
/** Sfx rendered as seamless loops (played with `loop()`); they also work as one-shots. */
export const WS_LOOP_SFX: readonly WsSfx[] = ['engine', 'spin'];

export type WsAudioKind = 'music' | 'sting' | 'sfx';

export interface WsAudioEntry {
  /** Path under public/audio/workshop, e.g. "music/title.ogg". */
  file: string;
  kind: WsAudioKind;
  sampleRate: number;
  /** Samples per channel of the source PCM (one loop / one shot). */
  length: number;
  channels: 1 | 2;
  /** The file holds this many back-to-back copies; playback uses the middle one (no codec edge artifacts at the loop seam). */
  copies: number;
  loop: boolean;
  /** Seconds of one source copy. */
  seconds: number;
  bpm?: number;
  lengthBeats?: number;
}

export interface WsAudioManifest {
  version: 1;
  /** Hash of the synthesis sources (scripts/workshopAudioHash.ts). */
  sourceHash: string;
  /** Keys are `music:<name>`, `sting:<name>`, `sfx:<name>`. */
  files: Record<string, WsAudioEntry>;
}

export const wsAudioKey = (kind: WsAudioKind, name: string): string => `${kind}:${name}`;

/** Start offset in seconds of the copy to use when a file holds several back-to-back copies (the middle one). */
export function copyStartSec(e: Pick<WsAudioEntry, 'seconds' | 'copies'>): number {
  return e.copies > 1 ? e.seconds * Math.floor(e.copies / 2) : 0;
}

/** Repeats `src` back to back `copies` times. */
export function repeatSamples(src: Float32Array, copies: number): Float32Array {
  const out = new Float32Array(src.length * copies);
  for (let i = 0; i < copies; i++) out.set(src, i * src.length);
  return out;
}
