/** Phaser-free paging helpers for menu lists. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
/** Clamps an index (page or list position) into [0, count-1]. */
export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(0, page), Math.max(0, count - 1));
}
export function pageItems<T>(items: readonly T[], page: number, perPage: number): T[] {
  return items.slice(page * perPage, (page + 1) * perPage);
}
