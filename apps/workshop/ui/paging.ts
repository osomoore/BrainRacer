/** Pure paging helpers (no Phaser). */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(0, page), Math.max(0, count - 1));
}

export function pageItems<T>(items: readonly T[], page: number, perPage: number): T[] {
  return items.slice(page * perPage, (page + 1) * perPage);
}

/** Page that contains item `index`. */
export function pageOf(index: number, perPage: number): number {
  return Math.floor(Math.max(0, index) / Math.max(1, perPage));
}
