import type { WorkshopProgress } from '../core/types';
import { isLearningChallenge } from './learning';

const MAX_FLUSH_MS = 60 * 60 * 1000;

/** Resolve the selected board challenge against current progress before attributing time. */
export function eligibleActiveChallenge(progress: WorkshopProgress | undefined, selectedId: string | undefined): string | undefined {
  if (!progress || !selectedId || !progress.active.includes(selectedId)) return undefined;
  const challenge = progress.challenges[selectedId];
  if (!challenge || !isLearningChallenge(challenge) || progress.completed[selectedId]
    || progress.learning?.[selectedId]?.wonAt !== undefined) return undefined;
  return selectedId;
}

export interface AttributionState {
  profileId?: string;
  workshop?: string;
  screen: string;
  admin: boolean;
  visible: boolean;
  active: boolean;
  progress?: WorkshopProgress;
}

/** Session selection and timer transition logic shared by PaneScene and Phaser-free tests. */
export class ActiveChallengeAttribution {
  private running?: string;

  constructor(private readonly tracker: ActiveTimeTracker, private readonly selected: Map<string, string> = new Map()) {}

  select(profileId: string | undefined, workshop: string | undefined, challengeId: string | undefined): void {
    if (profileId && workshop && challengeId) this.selected.set(`${profileId}|${workshop}`, challengeId);
  }

  sync(state: AttributionState): void {
    const selectionKey = state.profileId && state.workshop ? `${state.profileId}|${state.workshop}` : '';
    const selected = this.selected.get(selectionKey);
    const challengeId = eligibleActiveChallenge(state.progress, selected);
    const allowed = ['board', 'room', 'station', 'buddyStation'].includes(state.screen);
    const next = state.profileId && state.workshop && allowed && !state.admin && state.visible && state.active && challengeId
      ? activeTimeKey(state.workshop, state.profileId, challengeId) : undefined;
    if (this.running && this.running !== next) this.tracker.pause(this.running);
    this.running = next;
    if (next) this.tracker.resume(next);
  }

  pause(): void {
    if (this.running) this.tracker.pause(this.running);
    this.running = undefined;
  }
}

export interface ActiveTimeTracker {
  resume(id: string): void;
  pause(id?: string): void;
  /** Cut and return this ID's accumulated time; a running ID continues afterward. */
  flush(id: string): number;
}

/** Tracks selected-challenge time without depending on Phaser or a global clock. */
export function createActiveTimeTracker(now: () => number): ActiveTimeTracker {
  const pending = new Map<string, number>();
  const starts = new Map<string, number>();

  const cut = (id: string, restart: boolean): void => {
    const startedAt = starts.get(id);
    if (startedAt === undefined) return;
    const current = now();
    const elapsed = Math.max(0, current - startedAt);
    pending.set(id, (pending.get(id) ?? 0) + Math.floor(Math.min(MAX_FLUSH_MS, elapsed)));
    if (restart) starts.set(id, current);
    else starts.delete(id);
  };

  return {
    resume(id) {
      if (!starts.has(id)) starts.set(id, now());
    },
    pause(id) {
      if (id === undefined) {
        for (const key of [...starts.keys()]) cut(key, false);
      } else cut(id, false);
    },
    flush(id) {
      cut(id, true);
      const elapsed = Math.min(MAX_FLUSH_MS, pending.get(id) ?? 0);
      pending.delete(id);
      return elapsed;
    },
  };
}

export const activeTimeTracker = createActiveTimeTracker(() => performance.now());

export function activeTimeKey(workshop: string, profileId: string | undefined, challengeId: string): string {
  return `${profileId ?? 'guest'}|${workshop}|${challengeId}`;
}
