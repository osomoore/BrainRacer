/**
 * Mobile detection, decided once per page load. Mobile = a phone/tablet whose PRIMARY pointer is a coarse,
 * non-hovering touchscreen (`(pointer: coarse) and (hover: none)`). Touchscreen laptops have a fine primary
 * pointer and the Android TV box has no touchscreen, so both stay "desktop".
 * Test override: `?mobile=1` / `?mobile=0` on any page; remembered in sessionStorage for the tab so it survives
 * launcher -> game navigation (`?mobile=auto` clears it).
 */
const KEY = 'brainracer.mobileOverride';

export interface MobileInputs {
  /** Parsed `?mobile=` value on this page (null = absent). */
  override: boolean | null;
  /** Override remembered from an earlier page in this tab. */
  stored: boolean | null;
  coarse: boolean;
  noHover: boolean;
}

/** '1'/'true' -> true, '0'/'false' -> false, anything else -> null. */
export function parseOverride(v: string | null | undefined): boolean | null {
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return null;
}

/** Pure decision: this page's override wins, then the remembered one, then the media query. */
export function decideMobile(i: MobileInputs): boolean {
  if (i.override !== null) return i.override;
  if (i.stored !== null) return i.stored;
  return i.coarse && i.noHover;
}

let cached: boolean | undefined;

export function isMobile(): boolean {
  if (cached !== undefined) return cached;
  let override: boolean | null = null;
  let stored: boolean | null = null;
  let coarse = false;
  let noHover = false;
  try {
    const raw = new URLSearchParams(location.search).get('mobile');
    override = parseOverride(raw);
    try {
      if (override !== null) sessionStorage.setItem(KEY, override ? '1' : '0');
      else if (raw === 'auto') sessionStorage.removeItem(KEY);
      else stored = parseOverride(sessionStorage.getItem(KEY));
    } catch { /* storage unavailable */ }
    coarse = window.matchMedia('(pointer: coarse)').matches;
    noHover = window.matchMedia('(hover: none)').matches;
  } catch { /* no window (tests) */ }
  cached = decideMobile({ override, stored, coarse, noHover });
  return cached;
}
