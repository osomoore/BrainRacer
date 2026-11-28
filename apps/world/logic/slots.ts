import type { Creation, CreationSlot, WorldPlayerSave } from '../core/types';
import type { WorkshopId } from '../../workshop/core/types';
import { loadWorkshopPlayer, normalizeWorkshopModel } from './save';

export function defaultSlots(lastWorkshop: WorkshopId = 'race'): Pick<WorldPlayerSave, 'primary' | 'alternate' | 'using'> {
  const other: WorkshopId = lastWorkshop === 'race' ? 'dino' : 'race';
  return { primary: { source: 'live', workshop: lastWorkshop }, alternate: { source: 'live', workshop: other }, using: 'primary' };
}

export function resolveSlot(profileId: string, slot: CreationSlot): Creation {
  const model = slot.source === 'copy' ? normalizeWorkshopModel(slot.workshop, slot.model)
    : normalizeWorkshopModel(slot.workshop, loadWorkshopPlayer(profileId)?.workshops[slot.workshop]?.model);
  return { workshop: slot.workshop, model };
}

export function activeCreation(profileId: string, save: WorldPlayerSave): Creation {
  const slot = save.using === 'alternate' && save.alternate ? save.alternate : save.primary;
  return resolveSlot(profileId, slot);
}

export function swapSlots(save: WorldPlayerSave): WorldPlayerSave {
  if (!save.alternate) return save;
  return { ...save, using: save.using === 'primary' ? 'alternate' : 'primary' };
}

export function takeCopy(profileId: string, save: WorldPlayerSave, which: 'primary' | 'alternate' = 'primary'): WorldPlayerSave {
  const slot = which === 'primary' ? save.primary : save.alternate;
  if (!slot) return save;
  const creation = resolveSlot(profileId, slot);
  const copy: CreationSlot = { source: 'copy', workshop: creation.workshop, model: creation.model };
  return { ...save, [which]: copy };
}

/**
 * Makes the slot for `workshop` the driven one (Workshop hand-off: the player just came from that room).
 * Prefers the slot already in use, then the other slot; otherwise a new live slot goes into the free one
 * (never overwriting a frozen copy).
 */
export function useWorkshop(save: WorldPlayerSave, workshop: WorkshopId): WorldPlayerSave {
  const current = save.using === 'alternate' && save.alternate ? save.alternate : save.primary;
  if (current.workshop === workshop) return save;
  if (save.using === 'primary' && save.alternate?.workshop === workshop) return { ...save, using: 'alternate' };
  if (save.using === 'alternate' && save.primary.workshop === workshop) return { ...save, using: 'primary' };
  const live: CreationSlot = { source: 'live', workshop };
  if (!save.alternate) return { ...save, alternate: live, using: 'alternate' };
  return save.using === 'primary' ? { ...save, alternate: live, using: 'alternate' } : { ...save, primary: live, using: 'primary' };
}
