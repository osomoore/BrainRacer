import { MAX_PLAYERS } from '../../config/gameConfig';
import type { CarKind, InputDevice, PlayerSettings, RacerProfileId } from '../../core/types';
import { claimSlot as sharedClaimSlot, freeRacer as sharedFreeRacer, type JoinSlot, type RacerChoice } from '../../../shared/ui/menu/joinLogic';
export type { JoinSlot, RacerChoice };
export { allReady, canAdvance, isLocked, leaveSlot, nextRacer, racerOptions, setReady, waitingFor } from '../../../shared/ui/menu/joinLogic';
/** Slot indexes that duplicate an earlier active racer choice; synthetic/new slots are ignored. */
export function duplicateProfileSlots(profileIds: readonly (RacerProfileId | undefined)[], isNew: readonly boolean[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  profileIds.forEach((id, slot) => {
    if (isNew[slot] || id === undefined) return;
    if (seen.has(id)) duplicates.push(slot);
    else seen.add(id);
  });
  return duplicates;
}
export function claimSlot(slots: readonly JoinSlot[], device: InputDevice, max = MAX_PLAYERS): JoinSlot[] {
  return sharedClaimSlot(slots, device, max);
}
export function freeRacer(ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], preferred?: RacerProfileId): RacerProfileId | undefined {
  return sharedFreeRacer(ids, taken, preferred);
}
export function newJoinPlayer(index: number, device: InputDevice, prev: Partial<PlayerSettings> | undefined, firstCar: CarKind | undefined,
  ids: readonly RacerProfileId[], taken: readonly RacerProfileId[], defaultRacer?: RacerProfileId): PlayerSettings {
  return {
    ...prev,
    device,
    difficulty: prev?.difficulty ?? 'normal',
    car: prev?.car ?? (index === 0 ? 'dino' : firstCar === 'dino' || firstCar === undefined ? 'kart' : 'dino'),
    profile: sharedFreeRacer(ids, taken, prev?.profile ?? defaultRacer),
  };
}
