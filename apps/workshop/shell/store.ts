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
  private playersCache?: { raw: string | null; saves: Map<string, string> };

  constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

  private readRaw(key: string): string | null {
    let raw: string | null = null;
    try { raw = this.storage?.getItem(key) ?? null; } catch { raw = null; }
    return raw ?? this.memory.get(key) ?? null;
  }

  private read(key: string): unknown {
    const raw = this.readRaw(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  private normalizedPlayers(): Map<string, string> {
    const raw = this.readRaw(PLAYERS_KEY);
    if (this.playersCache?.raw === raw) return this.playersCache.saves;

    const saves = new Map<string, string>();
    if (raw !== null) {
      let value: unknown;
      try { value = JSON.parse(raw); } catch { value = null; }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
          const save = engine.normalizeSave(v);
          if (save) saves.set(id, JSON.stringify(save));
        }
      }
    }

    this.playersCache = { raw, saves };
    return saves;
  }

  private write(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try { this.storage?.setItem(key, raw); } catch { /* memory fallback only */ }
  }

  /** Every saved player, validated. */
  players(): Record<string, PlayerSave> {
    const out: Record<string, PlayerSave> = {};
    for (const [id, save] of this.normalizedPlayers()) out[id] = JSON.parse(save) as PlayerSave;
    return out;
  }

  player(profileId: string): PlayerSave | null {
    const save = this.normalizedPlayers().get(profileId);
    return save === undefined ? null : JSON.parse(save) as PlayerSave;
  }

  hasPlayer(profileId: string): boolean { return this.normalizedPlayers().has(profileId); }

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
