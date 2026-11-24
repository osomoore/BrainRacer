/** Pure join rules for the title screen (tested). Slot 0 = Player 1 = left pane. */
import { deviceKey, type DeviceAction, type DeviceId } from '../../../shared/input/deviceInput';

export interface JoinState { slots: readonly DeviceId[] }

export type JoinResult = 'joined' | 'left' | 'start' | 'hub' | 'none';

export const emptyJoin: JoinState = { slots: [] };

export function slotOf(state: JoinState, device: DeviceId): number {
  return state.slots.findIndex((d) => deviceKey(d) === deviceKey(device));
}

/**
 * Applies one action from one device.
 * Nobody joined yet: ANY button / key (move, confirm, menu) from a device makes it Player 1. After that a second
 * device joins as Player 2 with confirm / menu only (a stray arrow key must not add a player).
 * Player 1's confirm (or menu from a joined device) starts. back: a joined device leaves; with nobody joined it
 * leaves the game (back to the launcher).
 */
export function reduceJoin(state: JoinState, device: DeviceId, action: DeviceAction, max: number): { state: JoinState; result: JoinResult } {
  const slot = slotOf(state, device);
  if (action === 'back') {
    if (slot >= 0) return { state: { slots: state.slots.filter((_, i) => i !== slot) }, result: 'left' };
    return { state, result: state.slots.length === 0 ? 'hub' : 'none' };
  }
  if (slot < 0) {
    const first = state.slots.length === 0;
    if (!first && action !== 'confirm' && action !== 'menu') return { state, result: 'none' };
    if (state.slots.length >= max) return { state, result: 'none' };
    return { state: { slots: [...state.slots, device] }, result: 'joined' };
  }
  if (action === 'confirm' || action === 'menu') return { state, result: slot === 0 || action === 'menu' ? 'start' : 'none' };
  return { state, result: 'none' };
}

/** The button that starts for this device, as shown to the player ("A", "Space", "Enter"). */
export function goButtonLabel(device: DeviceId | undefined): string {
  if (!device) return 'A';
  return device.kind === 'pad' ? 'A' : device.kind === 'kb' ? (device.layout === 1 ? 'Space' : 'Enter') : 'Tap';
}
