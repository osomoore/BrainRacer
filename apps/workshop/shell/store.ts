/**
 * Saves store: `workshop.players.v1` (Record<profileId, PlayerSave>) and `workshop.device.v1` (DeviceSave) in
 * localStorage, with an in-memory fallback when storage is blocked. Pure of Phaser; storage is injectable for tests.
 * Saves are validated through `engine.normalizeSave`; unreadable data is treated as missing.
 */
import type { DeviceSave, PlayerSave } from '../core/types';
import { engine } from '../logic';
import { notifyProfileChanged } from '../../../shared/sync/changes';
import { resolveActiveProfileId } from '../../../shared/profiles';

export const PLAYERS_KEY = 'workshop.players.v1';
export const DEVICE_KEY = 'workshop.device.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class SaveStore {
  private readonly memory = new Map<string, string>();

  constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

  private read(key: string): unknown {
    let raw: string | null = null;
    try { raw = this.storage?.getItem(key) ?? null; } catch { raw = null; }
    raw ??= this.memory.get(key) ?? null;
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  private write(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try { this.storage?.setItem(key, raw); } catch { /* memory fallback only */ }
  }

  /** Every saved player, validated. */
  players(): Record<string, PlayerSave> {
    const raw = this.read(PLAYERS_KEY);
    const out: Record<string, PlayerSave> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
        const save = engine.normalizeSave(v);
        if (save) out[id] = save;
      }
    }
    return out;
  }

  player(profileId: string): PlayerSave | null {
    return this.players()[profileId] ?? null;
  }

  hasPlayer(profileId: string): boolean { return this.player(profileId) !== null; }

  setPlayer(profileId: string, save: PlayerSave): void {
    const activeId = resolveActiveProfileId(profileId);
    if (!activeId || activeId !== profileId) return;
    const raw = this.read(PLAYERS_KEY);
    const others = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const changed = JSON.stringify(others[activeId]) !== JSON.stringify(save);
    this.write(PLAYERS_KEY, { ...others, [activeId]: save });
    if (changed) notifyProfileChanged(activeId);
  }

  device(): DeviceSave {
    const raw = this.read(DEVICE_KEY) as Partial<DeviceSave> | null;
    return { version: 1, adminMode: !!raw && raw.adminMode === true };
  }

  setDevice(save: DeviceSave): void { this.write(DEVICE_KEY, save); }
}
