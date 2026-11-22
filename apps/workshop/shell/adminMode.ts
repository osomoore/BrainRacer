/**
 * Admin Mode helpers for screens (board package): while `ctx.adminMode` is on, the board shows a "New Challenges"
 * button that calls `newAdminChallenges(ctx)`. It rebuilds this player's sandbox (new seed, 10 challenges across all
 * tiers, keeps the sandbox model). The caller then re-reads `ctx.save()` and redraws. Nothing is saved.
 */
import type { PaneContext } from '../core/runtime';
import { engine } from '../logic';
import { shell } from './shell';

/** Returns true when a sandbox was rebuilt (Admin Mode on, profile + workshop chosen). */
export function newAdminChallenges(ctx: PaneContext): boolean {
  const id = ctx.profileId;
  const ws = ctx.workshop;
  if (!ctx.adminMode || !id || !ws) return false;
  const real = shell.store.player(id) ?? engine.newPlayerSave('medium');
  shell.sandboxes.rebuild(id, ws, real);
  return true;
}
