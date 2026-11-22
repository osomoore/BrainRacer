/** Phaser-free rules for the Join screen (slot claiming, ready/lock, who may advance). */
import { MAX_PLAYERS } from '../../config/gameConfig';
import type { CarKind, InputDevice, PlayerSettings, RacerProfileId } from '../../core/types';
import { racerChoices, cycleChoice, type RacerChoice } from './newRacerLogic';

export interface JoinSlot { device: InputDevice; ready: boolean }

export const devKey = (d: InputDevice): string => (d.type === 'gamepad' ? `pad${d.index}` : `kb-${d.layout}`);
export const sameDevice = (a: InputDevice, b: InputDevice): boolean => devKey(a) === devKey(b);

/** A device claims the next free panel (appended). Unchanged if it already has one or all panels are taken. */
export function claimSlot(slots: readonly JoinSlot[], device: InputDevice, max = MAX_PLAYERS): JoinSlot[] {
  if (slots.length >= max || slots.some((s) => sameDevice(s.device, device))) return [...slots];
  return [...slots, { device, ready: false }];
}

/** Removes a panel; later players move up one slot. */
export function leaveSlot(slots: readonly JoinSlot[], index: number): JoinSlot[] {
  return slots.filter((_, i) => i !== index);
}

export function setReady(slots: readonly JoinSlot[], index: number, ready: boolean): JoinSlot[] {
  return slots.map((s, i) => (i === index ? { ...s, ready } : s));
}

export const allReady = (slots: readonly JoinSlot[]): boolean => slots.length > 0 && slots.every((s) => s.ready);

/** A ready panel is locked: its racer / car / buddy can't change until the player un-readies. */
export const isLocked = (slots: readonly JoinSlot[], index: number): boolean => !!slots[index]?.ready;

/** Only Player 1 (slot 0) may move on, and only once every joined player is ready. */
export const canAdvance = (slots: readonly JoinSlot[], player: number): boolean => player === 0 && allReady(slots);

/** Slot numbers (1-based) that are not ready yet, for the "Waiting for P3..." hint. */
export const waitingFor = (slots: readonly JoinSlot[]): number[] =>
  slots.flatMap((s, i) => (s.ready ? [] : [i + 1]));

/** Racers a player can cycle through: not held by any other player; "new" last when allowed. */
export function racerOptions(ids: readonly RacerProfileId[], takenByOthers: readonly RacerProfileId[], canNew: boolean): RacerChoice[] {
  return racerChoices(ids, takenByOthers, canNew);
}

export function nextRacer(
  ids: readonly RacerProfileId[], takenByOthers: readonly RacerProfileId[], canNew: boolean, current: RacerChoice, dir: 1 | -1,
): RacerChoice {
  return cycleChoice(racerOptions(ids, takenByOthers, canNew), current, dir);
}

/** First free racer, preferring `preferred`. Falls back to `preferred` itself if everything is taken. */
export function freeRacer(ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], preferred?: RacerProfileId): RacerProfileId {
  if (preferred && ids.includes(preferred) && !taken.includes(preferred)) return preferred;
  return ids.find((r) => !taken.includes(r)) ?? preferred ?? ids[0];
}

/** Settings for a player who just joined slot `index` (saved choices reused when the racer is still free). */
export function newJoinPlayer(
  index: number, device: InputDevice, prev: Partial<PlayerSettings> | undefined, firstCar: CarKind | undefined,
  ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], defaultRacer?: RacerProfileId,
): PlayerSettings {
  const p0car: CarKind = firstCar ?? 'dino';
  return {
    ...prev,
    device,
    difficulty: prev?.difficulty ?? 'normal',
    car: prev?.car ?? (index === 0 ? 'dino' : p0car === 'dino' ? 'kart' : 'dino'),
    profile: freeRacer(ids, taken, prev?.profile ?? defaultRacer),
  };
}
