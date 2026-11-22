/** Logical stage size (the page is drawn at this size and scaled to the window). */
export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Scale that fits the whole stage in the window, keeping its aspect ratio (letterboxed). */
export function fitScale(winW: number, winH: number): number {
  if (winW <= 0 || winH <= 0) return 1;
  return Math.min(winW / STAGE_W, winH / STAGE_H);
}
