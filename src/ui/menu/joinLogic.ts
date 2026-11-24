import { MAX_PLAYERS } from '../../config/gameConfig';
import type { CarKind, InputDevice, PlayerSettings, RacerProfileId } from '../../core/types';
import { claimSlot as sharedClaimSlot, freeRacer as sharedFreeRacer, type JoinSlot, type RacerChoice } from '../../../shared/ui/menu/joinLogic';
export type { JoinSlot, RacerChoice };
export { allReady, canAdvance, isLocked, leaveSlot, nextRacer, racerOptions, setReady, waitingFor } from '../../../shared/ui/menu/joinLogic';
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
