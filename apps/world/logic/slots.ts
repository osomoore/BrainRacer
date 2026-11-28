import type { Creation, WorkshopId, WorldPlayerSave } from '../core/types';
import { loadWorkshopPlayer, normalizeWorkshopModel } from './save';

export function activeCreation(profileId: string, { using }: WorldPlayerSave): Creation {
  const model = loadWorkshopPlayer(profileId)?.workshops[using]?.model;
  return { workshop: using, model: normalizeWorkshopModel(using, model) };
}

export function swapCreation(workshop: WorkshopId): WorkshopId {
  return workshop === 'race' ? 'dino' : 'race';
}
