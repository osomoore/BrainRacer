/**
 * Admin Mode sandboxes: per (profile, workshop) in-memory WorkshopProgress built by `engine.adminSandbox`.
 * Nothing here is ever written to storage. Cleared whenever Admin Mode is switched on or off.
 */
import type { PlayerSave, WorkshopId, WorkshopProgress } from '../core/types';
import { WS_RULES } from '../config';
import { engine } from '../logic';

export class AdminSandboxes {
  private readonly map = new Map<string, WorkshopProgress>();
  private counter = 0;

  private static key(profileId: string, workshop: WorkshopId): string { return `${profileId}:${workshop}`; }

  /** Seeds are time based plus a counter (Admin Mode is not gameplay, so no Rng is needed). */
  nextSeed(): number {
    this.counter += 1;
    return ((Date.now() & 0x7fffffff) ^ Math.imul(this.counter, 2654435761)) >>> 0;
  }

  /** The sandbox progress, built from the real save on first use. */
  get(profileId: string, workshop: WorkshopId, real: PlayerSave): WorkshopProgress {
    const key = AdminSandboxes.key(profileId, workshop);
    let p = this.map.get(key);
    if (!p) {
      p = engine.adminSandbox(workshop, engine.progressOf(real, workshop), this.nextSeed(), WS_RULES.adminBoardSize);
      this.map.set(key, p);
    }
    return p;
  }

  set(profileId: string, workshop: WorkshopId, progress: WorkshopProgress): void {
    this.map.set(AdminSandboxes.key(profileId, workshop), progress);
  }

  /** Throws the sandbox away and builds a new one with a new seed ("New Challenges"). Keeps the sandbox model. */
  rebuild(profileId: string, workshop: WorkshopId, real: PlayerSave): WorkshopProgress {
    const key = AdminSandboxes.key(profileId, workshop);
    const old = this.map.get(key);
    const base = engine.progressOf(real, workshop);
    const source = old ? { ...base, model: old.model } : base;
    const p = engine.adminSandbox(workshop, source, this.nextSeed(), WS_RULES.adminBoardSize);
    this.map.set(key, p);
    return p;
  }

  clear(): void { this.map.clear(); }

  /** Drops cached practice state for one profile after a delete or merge. */
  removeProfile(profileId: string): void {
    for (const key of this.map.keys()) if (key.startsWith(`${profileId}:`)) this.map.delete(key);
  }

  get size(): number { return this.map.size; }
}

/** The save a pane sees: the real save with the sandbox progress swapped in for the current workshop. */
export function sandboxSave(real: PlayerSave, workshop: WorkshopId, progress: WorkshopProgress): PlayerSave {
  return { ...real, workshops: { ...real.workshops, [workshop]: progress } };
}
