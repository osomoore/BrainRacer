/** Ignore the first input frame after a modal closes; keep ignoring while its Back button remains held. */
export function waitForRelease(waiting: boolean, backHeld: boolean): { waiting: boolean; ignore: boolean } {
  if (!waiting) return { waiting: false, ignore: false };
  return backHeld ? { waiting: true, ignore: true } : { waiting: false, ignore: true };
}
