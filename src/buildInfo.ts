/** Build stamp injected by vite.config.ts (`define`). Trailing "+" = built from uncommitted changes. */
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
/** ISO timestamp injected by the production build. */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

const CHICAGO = 'America/Chicago';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a build timestamp in the supplied zone, or the device zone when omitted. */
export function formatBuildTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';

  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    let deviceZone = timeZone;
    if (!deviceZone) {
      try { deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* use fallback zones */ }
    }
    for (const zone of [deviceZone, CHICAGO, 'UTC']) {
      if (!zone) continue;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          timeZoneName: 'short',
        }).formatToParts(date);
        const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
        const month = part('month'), day = part('day'), hour = part('hour');
        const minute = part('minute'), period = part('dayPeriod'), zoneName = part('timeZoneName');
        if (month && day && hour && minute && period && zoneName) {
          return `${month} ${day}, ${hour}:${minute} ${period} ${zoneName}`;
        }
      } catch { /* invalid zone or broken Intl implementation; try the next zone */ }
    }
  }

  // Keep the label useful even on runtimes without Intl.
  const month = MONTHS[date.getUTCMonth()];
  const hour24 = date.getUTCHours();
  const hour = hour24 % 12 || 12;
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month} ${date.getUTCDate()}, ${hour}:${minute} ${hour24 < 12 ? 'AM' : 'PM'} UTC`;
}

/** e.g. "Build 5e5b19a · Nov 25, 4:12 AM CST" */
export function buildLabel(): string {
  const formatted = BUILD_TIME ? formatBuildTime(BUILD_TIME) : '';
  return formatted ? `Build ${BUILD_ID} · ${formatted}` : `Build ${BUILD_ID}`;
}
