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
 * confirm: unjoined device joins (up to `max`); Player 1's confirm starts. menu (Start/Tab) from a joined device starts.
 * back: a joined device leaves; with nobody joined it leaves the game (back to the launcher).
 */
export function reduceJoin(state: JoinState, device: DeviceId, action: DeviceAction, max: number): { state: JoinState; result: JoinResult } {
  const slot = slotOf(state, device);
  if (action === 'confirm') {
    if (slot < 0) {
      if (state.slots.length >= max) return { state, result: 'none' };
      return { state: { slots: [...state.slots, device] }, result: 'joined' };
    }
    return { state, result: slot === 0 ? 'start' : 'none' };
  }
  if (action === 'menu') return { state, result: slot >= 0 ? 'start' : 'none' };
  if (action === 'back') {
    if (slot >= 0) return { state: { slots: state.slots.filter((_, i) => i !== slot) }, result: 'left' };
    return { state, result: state.slots.length === 0 ? 'hub' : 'none' };
  }
  return { state, result: 'none' };
}

/** Text for one slot line on the title screen. */
export function slotLine(index: number, device: DeviceId | undefined, joinLabel: string): string {
  return device ? `Player ${index + 1} ✓` : `Player ${index + 1}: ${joinLabel}`;
}
