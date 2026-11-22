/**
 * One WorkshopAudio shared by the whole game, wrapped per pane: sfx are panned left / right in 2-player mode and
 * music is arbitrated (both panes want different tracks -> 'title'; a pane asking for silence yields to the other).
 */
import type { WorkshopAudio, WsMusic } from '../core/runtime';

/** Pure arbitration over each pane's wanted track (null = no opinion / silence). */
export function arbitrateMusic(wants: readonly (WsMusic | null | undefined)[]): WsMusic | null {
  const tracks = wants.filter((w): w is WsMusic => !!w);
  if (tracks.length === 0) return null;
  return tracks.every((t) => t === tracks[0]) ? tracks[0] : 'title';
}

/** Sfx pan for a pane: 1P = the caller's pan; 2P = left / right, mixed with the caller's pan. */
export function paneSfxPan(index: 0 | 1, count: 1 | 2, pan = 0): number {
  if (count === 1) return pan;
  const side = index === 0 ? -0.7 : 0.7;
  return Math.max(-1, Math.min(1, side + pan * 0.3));
}

export class AudioMixer {
  private wants: (WsMusic | null)[] = [null, null];
  private current: WsMusic | null | undefined;
  count: 1 | 2 = 1;

  constructor(private readonly base: WorkshopAudio) {}

  setWant(index: 0 | 1, track: WsMusic | null): void {
    this.wants[index] = track;
    this.apply();
  }

  /** Forget every pane's request (game returns to the title). */
  clear(): void {
    this.wants = [null, null];
    this.apply();
  }

  private apply(): void {
    const t = arbitrateMusic(this.count === 1 ? [this.wants[0]] : this.wants);
    if (t === this.current) return;
    this.current = t;
    this.base.music(t);
  }

  forPane(index: 0 | 1): WorkshopAudio {
    return {
      music: (track) => this.setWant(index, track),
      sfx: (name, opts) => this.base.sfx(name, { ...opts, pan: paneSfxPan(index, this.count, opts?.pan) }),
      sting: (name) => this.base.sting(name),
      loop: (name, opts) => this.base.loop(name, opts),
    };
  }
}
