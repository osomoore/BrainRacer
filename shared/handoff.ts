/**
 * One-shot hand-off between Adventure Workshop and Adventure World so a player swap does not re-pick players.
 * The sender writes who is playing (profile + device, in P1 / P2 order) right before navigating; the next page
 * takes it once. It expires quickly so a stale entry never hijacks a later normal start.
 * Pure: storage is injectable for tests (default sessionStorage, falling back to localStorage).
 */
import type { DeviceId } from './input/deviceInput';

export type HandoffTarget = 'world' | 'workshop';
export type HandoffWorkshop = 'car' | 'dino';

export interface HandoffPlayer {
  profileId: string;
  device: DeviceId;
  /** Which build the player was working on / should drive. */
  workshop?: HandoffWorkshop;
}

export interface Handoff { to: HandoffTarget; players: HandoffPlayer[] }

export interface HandoffStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const HANDOFF_KEY = 'brainracer.handoff.v1';
export const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000;

function stores(): HandoffStorage[] {
  const out: HandoffStorage[] = [];
  try { if (globalThis.sessionStorage) out.push(globalThis.sessionStorage); } catch { /* blocked */ }
  try { if (globalThis.localStorage) out.push(globalThis.localStorage); } catch { /* blocked */ }
  return out;
}

function validDevice(d: unknown): d is DeviceId {
  if (!d || typeof d !== 'object') return false;
  const v = d as { kind?: unknown; index?: unknown; layout?: unknown };
  if (v.kind === 'touch') return true;
  if (v.kind === 'kb') return v.layout === 1 || v.layout === 2;
  return v.kind === 'pad' && Number.isInteger(v.index) && (v.index as number) >= 0;
}

function validPlayer(p: unknown): p is HandoffPlayer {
  if (!p || typeof p !== 'object') return false;
  const v = p as { profileId?: unknown; device?: unknown; workshop?: unknown };
  return typeof v.profileId === 'string' && v.profileId !== '' && validDevice(v.device)
    && (v.workshop === undefined || v.workshop === 'car' || v.workshop === 'dino');
}

/** Stores the hand-off for the next page. Never throws; players are kept in order (max 2). */
export function writeHandoff(h: Handoff, now = Date.now(), storages: readonly HandoffStorage[] = stores()): void {
  const players = h.players.filter(validPlayer).slice(0, 2);
  if (!players.length) return;
  const raw = JSON.stringify({ to: h.to, at: now, players });
  for (const s of storages) {
    try { s.setItem(HANDOFF_KEY, raw); return; } catch { /* try the next store */ }
  }
}

/** Returns the hand-off addressed to `to` once (it is consumed), or null when missing, stale, or for the other app. */
export function takeHandoff(to: HandoffTarget, now = Date.now(), storages: readonly HandoffStorage[] = stores()): Handoff | null {
  let found: Handoff | null = null;
  for (const s of storages) {
    let raw: string | null = null;
    try { raw = s.getItem(HANDOFF_KEY); } catch { raw = null; }
    if (raw === null) continue;
    let parse: unknown = null;
    try { parse = JSON.parse(raw); } catch { parse = null; }
    const v = parse as { to?: unknown; at?: unknown; players?: unknown } | null;
    const ok = !!v && v.to === to && typeof v.at === 'number' && now - v.at >= -1000 && now - v.at < HANDOFF_MAX_AGE_MS
      && Array.isArray(v.players);
    if (ok && !found) {
      const players = (v.players as unknown[]).filter(validPlayer).slice(0, 2);
      if (players.length) found = { to, players };
    }
    // Entries for the other app stay (it may be a second tab's); ours, stale or not, are dropped.
    if (!v || v.to === to || typeof v.at !== 'number' || now - v.at >= HANDOFF_MAX_AGE_MS) {
      try { s.removeItem(HANDOFF_KEY); } catch { /* ignore */ }
    }
  }
  return found;
}
