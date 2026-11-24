import { racerChoices, cycleChoice } from './newRacerLogic';
import type { RacerChoice } from './newRacerLogic';
export type { RacerChoice } from './newRacerLogic';

export type InputDevice = { type: 'gamepad'; index: number } | { type: 'touch' } | { type: 'keyboard'; layout: 'left' | 'right' };
export type CarKind = string;
export type RacerProfileId = string;
export interface PlayerSettings { device: InputDevice; difficulty?: string; car?: CarKind; profile?: RacerProfileId }
export interface JoinSlot { device: InputDevice; ready: boolean }
export const devKey = (d: InputDevice): string => d.type === 'gamepad' ? `pad${d.index}` : d.type === 'touch' ? 'touch' : `kb-${d.layout}`;
export const sameDevice = (a: InputDevice, b: InputDevice): boolean => devKey(a) === devKey(b);
export function claimSlot(slots: readonly JoinSlot[], device: InputDevice, max = 4): JoinSlot[] {
  if (slots.length >= max || slots.some((s) => sameDevice(s.device, device))) return [...slots];
  return [...slots, { device, ready: false }];
}
export const leaveSlot = (slots: readonly JoinSlot[], index: number): JoinSlot[] => slots.filter((_, i) => i !== index);
export const setReady = (slots: readonly JoinSlot[], index: number, ready: boolean): JoinSlot[] => slots.map((s, i) => i === index ? { ...s, ready } : s);
export const allReady = (slots: readonly JoinSlot[]): boolean => slots.length > 0 && slots.every((s) => s.ready);
export const isLocked = (slots: readonly JoinSlot[], index: number): boolean => !!slots[index]?.ready;
export const canAdvance = (slots: readonly JoinSlot[], player: number): boolean => player === 0 && allReady(slots);
export const waitingFor = (slots: readonly JoinSlot[]): number[] => slots.flatMap((s, i) => s.ready ? [] : [i + 1]);
export function racerOptions(ids: readonly RacerProfileId[], takenByOthers: readonly RacerProfileId[], canNew: boolean): RacerChoice[] {
  return racerChoices(ids, takenByOthers, canNew);
}
export function nextRacer(ids: readonly RacerProfileId[], takenByOthers: readonly RacerProfileId[], canNew: boolean, current: RacerChoice, dir: 1 | -1): RacerChoice {
  return cycleChoice(racerOptions(ids, takenByOthers, canNew), current, dir);
}
export function freeRacer(ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], preferred?: RacerProfileId): RacerProfileId | undefined {
  if (preferred && ids.includes(preferred) && !taken.includes(preferred)) return preferred;
  return ids.find((r) => !taken.includes(r));
}
export function newJoinPlayer(index: number, device: InputDevice, prev: Partial<PlayerSettings> | undefined, firstCar: CarKind | undefined,
  ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], defaultRacer?: RacerProfileId): PlayerSettings {
  const p0car = firstCar ?? 'dino';
  return { ...prev, device, difficulty: prev?.difficulty ?? 'normal', car: prev?.car ?? (index === 0 ? 'dino' : p0car === 'dino' ? 'kart' : 'dino'),
    profile: freeRacer(ids, taken, prev?.profile ?? defaultRacer) };
}
