import type { Handoff } from '../../../shared/handoff';
import { getProfile, resolveActiveProfileId, type PlayerProfile } from '../../../shared/profiles';
import type { WorkshopId } from '../../workshop/core/types';
import type { DeviceId } from '../../../shared/input/deviceInput';

export interface ResumePlayer { profile: PlayerProfile; device: DeviceId; workshop?: WorkshopId }

/** Turns a Workshop hand-off into World player selections, dropping profiles that no longer exist and duplicates. */
export function resumeSelections(
  handoff: Handoff | null,
  lookup: (id: string) => PlayerProfile | undefined = (id) => getProfile(resolveActiveProfileId(id)),
): ResumePlayer[] {
  const out: ResumePlayer[] = [];
  for (const p of handoff?.players ?? []) {
    const profile = lookup(p.profileId);
    if (!profile || out.some((o) => o.profile.id === profile.id)) continue;
    out.push({ profile, device: p.device, ...(p.workshop ? { workshop: p.workshop === 'dino' ? 'dino' as const : 'race' as const } : {}) });
  }
  return out;
}
