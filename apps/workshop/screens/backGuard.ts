import { WS_UI } from '../config';

/** Per-pane cooldown shared across screens so a Back press cannot cascade through a screen transition. */
const blockedUntil = new WeakMap<object, number>();

/** Mark the pane as guarded after Back leaves a variant or part preview. */
export function guardBackAfterPreview(ctx: object, now: number): void {
  blockedUntil.set(ctx, Math.max(blockedUntil.get(ctx) ?? 0, now + WS_UI.backGuardMs));
}

/** True while the pane is inside the preview Back cooldown. */
export function isBackGuarded(ctx: object, now: number): boolean {
  return now < (blockedUntil.get(ctx) ?? 0);
}
