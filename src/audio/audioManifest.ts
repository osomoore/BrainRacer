/**
 * Shape of `public/audio/manifest.json`, written by `npm run audio:render` (scripts/renderAudio.ts) and read by the
 * 'files' audio mode. Pure types and helpers: no Phaser, no Tone, no DOM.
 */
export interface AudioFileEntry {
  /** Path under public/audio, e.g. "music/title.ogg". */
  file: string;
  /** Sample rate and length (samples per channel) of the source PCM: the decoded buffer is trimmed/padded to exactly this. */
  sampleRate: number;
  length: number;
  channels: 1 | 2;
  /** The encoded file holds this many back-to-back copies of the source (short loops: 3, so the middle copy is free of codec edge artifacts). */
  copies: number;
  loop: boolean;
}

export interface MusicFileEntry extends AudioFileEntry {
  bpm: number;
  lengthBeats: number;
  /** Duration of one loop (or of the track for one-shots, excluding the ring-out tail), in seconds. */
  loopSeconds: number;
}

export interface AudioManifest {
  version: 1;
  /** Hash of the audio source files this was rendered from (see scripts/audioSourceHash.ts). */
  sourceHash: string;
  sfx: Record<string, AudioFileEntry>;
  /** Continuous loops: 'siren-loud', 'siren-soft', 'skid'. */
  loops: Record<string, AudioFileEntry>;
  engine: AudioFileEntry;
  music: Record<string, MusicFileEntry>;
}

/** Index of the first sample of the copy to use when a file holds several back-to-back copies (the middle one). */
export function copyOffset(entry: Pick<AudioFileEntry, 'length' | 'copies'>): number {
  return entry.copies > 1 ? entry.length * Math.floor(entry.copies / 2) : 0;
}

/** Copies `length` samples starting at `offset` out of `src`, zero-padding if the decoded data is short. */
export function sliceExact(src: Float32Array, offset: number, length: number): Float32Array {
  const out = new Float32Array(length);
  if (offset < src.length) out.set(src.subarray(offset, Math.min(src.length, offset + length)));
  return out;
}

/** Repeats `src` back to back `copies` times. */
export function repeatSamples(src: Float32Array, copies: number): Float32Array {
  const out = new Float32Array(src.length * copies);
  for (let i = 0; i < copies; i++) out.set(src, i * src.length);
  return out;
}
