/** Build stamp injected by vite.config.ts (`define`). Trailing "+" = built from uncommitted changes. */
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

/** e.g. "Build 5e5b19a · 2026-11-20 21:45 UTC" */
export function buildLabel(): string {
  return BUILD_TIME ? `Build ${BUILD_ID} · ${BUILD_TIME}` : `Build ${BUILD_ID}`;
}
