import { WS_PARTVIEW } from '../../config';

/** Aspect ids the part walk visits (aspects without a visible part are skipped). */
export function partWalkOrder<T extends string>(ids: readonly T[]): T[] {
  return ids.filter((id) => !(WS_PARTVIEW.skip as readonly string[]).includes(id));
}

/** Move one step through catalog parts. Empty orders have no selection. */
export function stepPart<T extends string>(current: T | undefined, order: readonly T[], delta: -1 | 1): T | undefined {
  if (order.length === 0) return undefined;
  const index = current === undefined ? (delta === 1 ? -1 : 0) : order.indexOf(current);
  return order[(index + delta + order.length) % order.length];
}
