/**
 * Race Shop look tables: ONE description per variant, keyed by VariantId.
 * Both the side and the top drawings are generated from these numbers (same colours, same sizes),
 * so a part looks the same in both views. Codex: tweak numbers/colours here, drawing code stays generic.
 * Units: design pixels of a MEDIUM car; +x = front, y down, ground y = 0.
 */
import type { VariantId } from '../../core/types';

export interface PaintLook {
  main: string; dark: string; light: string;
  /** Rainbow: horizontal bands top to bottom. */
  bands?: readonly string[];
}
export const PAINT: Record<VariantId, PaintLook> = {
  'paint.blue': { main: '#2f8cff', dark: '#1659c4', light: '#8cc4ff' },
  'paint.yellow': { main: '#ffd21f', dark: '#e09a00', light: '#fff09a' },
  'paint.red': { main: '#ee3b3b', dark: '#b11d2c', light: '#ff9a8a' },
  'paint.green': { main: '#35c24a', dark: '#1b8a35', light: '#9ef0a0' },
  'paint.black': { main: '#3a3d4c', dark: '#1d1f2a', light: '#9096ac' },
  'paint.rainbow': {
    main: '#ffd21f', dark: '#b44bd0', light: '#fff09a',
    bands: ['#ff4b4b', '#ff9f2e', '#ffd21f', '#46d15a', '#3aa0ff', '#a45cf0'],
  },
};

export type BodyKind = 'car' | 'pickup' | 'sports' | 'van' | 'jeep';
export interface BodyLook {
  kind: BodyKind;
  /** Side length and chassis (lower body) height. */
  len: number; chH: number;
  /** Distance from the middle to each axle. */
  wheelX: number;
  /** Cabin bottom x range [rear, front] and height. */
  cab: readonly [number, number]; cabH: number;
  /** Multipliers of the shape's windshield / rear-window slant. */
  slantF: number; slantR: number;
  /** Top view half width. */
  hw: number;
  /** Pickup bed wall height (0 = none). */
  bedH: number;
  spare: boolean;
}
export const BODY: Record<VariantId, BodyLook> = {
  'body.car': { kind: 'car', len: 340, chH: 60, wheelX: 105, cab: [-110, 55], cabH: 58, slantF: 1, slantR: 1, hw: 62, bedH: 0, spare: false },
  'body.truck': { kind: 'pickup', len: 390, chH: 64, wheelX: 122, cab: [-12, 102], cabH: 56, slantF: 0.9, slantR: 0.2, hw: 66, bedH: 14, spare: false },
  'body.sports': { kind: 'sports', len: 370, chH: 46, wheelX: 118, cab: [-80, 55], cabH: 38, slantF: 1.3, slantR: 1.3, hw: 62, bedH: 0, spare: false },
  'body.van': { kind: 'van', len: 360, chH: 72, wheelX: 112, cab: [-176, 138], cabH: 70, slantF: 1, slantR: 0.1, hw: 66, bedH: 0, spare: false },
  'body.jeep': { kind: 'jeep', len: 330, chH: 62, wheelX: 100, cab: [-104, 46], cabH: 60, slantF: 0.15, slantR: 0.1, hw: 64, bedH: 0, spare: true },
};

export interface ShapeLook {
  /** Windshield / rear window slant as a fraction of cabin height. */
  slantF: number; slantR: number;
  /** Corner radius of the chassis / cabin. */
  r: number; rc: number;
  /** Cabin height multiplier; nose / tail chassis height multipliers. */
  cabK: number; noseK: number; tailK: number;
  /** Top view: superellipse exponent (higher = boxier) and width taper at tail / nose. */
  topN: number; topTail: number; topNose: number;
}
export const SHAPE: Record<VariantId, ShapeLook> = {
  'shape.boxy': { slantF: 0.3, slantR: 0.25, r: 8, rc: 6, cabK: 1, noseK: 1, tailK: 1, topN: 9, topTail: 1, topNose: 1 },
  'shape.round': { slantF: 0.95, slantR: 0.95, r: 36, rc: 34, cabK: 1.1, noseK: 0.95, tailK: 0.95, topN: 2.1, topTail: 1, topNose: 1 },
  'shape.sleek': { slantF: 1.6, slantR: 1.9, r: 20, rc: 24, cabK: 0.88, noseK: 0.7, tailK: 0.9, topN: 2.6, topTail: 0.88, topNose: 0.72 },
  'shape.wedge': { slantF: 0.9, slantR: 0.15, r: 5, rc: 4, cabK: 0.95, noseK: 0.38, tailK: 1.2, topN: 4, topTail: 1, topNose: 0.5 },
};

export const SIZE_SCALE: Record<VariantId, number> = {
  'size.tiny': 0.6, 'size.small': 0.8, 'size.medium': 1, 'size.big': 1.3,
};

export type TreadKind = 'grooves' | 'lugs' | 'slick' | 'zigzag' | 'monster';
export interface WheelLook {
  r: number; /** top view tyre width */ topW: number;
  tire: string; tread: TreadKind; treadColor: string; stripe?: string;
  rim: string; rimDark: string; /** rim radius as a fraction of r */ rimK: number; spokes: number;
}
export const WHEEL: Record<VariantId, WheelLook> = {
  'wheels.road': { r: 38, topW: 24, tire: '#2c2c3a', tread: 'grooves', treadColor: '#14141f', rim: '#d7dde6', rimDark: '#8d97a6', rimK: 0.58, spokes: 5 },
  'wheels.mud': { r: 46, topW: 36, tire: '#5a4631', tread: 'lugs', treadColor: '#2a1d12', rim: '#aab2bd', rimDark: '#6d7682', rimK: 0.46, spokes: 6 },
  'wheels.racing': { r: 34, topW: 40, tire: '#23232b', tread: 'slick', treadColor: '#111118', stripe: '#ffd21f', rim: '#ffcf33', rimDark: '#c78a00', rimK: 0.74, spokes: 7 },
  'wheels.snow': { r: 48, topW: 34, tire: '#eaf6ff', tread: 'zigzag', treadColor: '#5fa3d6', rim: '#3d7fd0', rimDark: '#1f4f96', rimK: 0.5, spokes: 6 },
  'wheels.monster': { r: 78, topW: 54, tire: '#2a2a34', tread: 'monster', treadColor: '#10101a', rim: '#ff5a3c', rimDark: '#b3261a', rimK: 0.5, spokes: 8 },
};

export interface SpringLook {
  /** Extra ride height under the body. */
  lift: number;
  coil: string; coilDark: string; turns: number; width: number; thick: number;
  /** Shock absorber beside the coil. */
  shock: string | null;
}
export const SPRING: Record<VariantId, SpringLook> = {
  'springs.soft': { lift: 16, coil: '#7fc4ff', coilDark: '#2d7cc4', turns: 4, width: 28, thick: 7, shock: null },
  'springs.sport': { lift: 6, coil: '#ff4d4d', coilDark: '#a01c28', turns: 6, width: 20, thick: 5, shock: '#ffd21f' },
  'springs.lifted': { lift: 58, coil: '#ffb02e', coilDark: '#b36b00', turns: 7, width: 26, thick: 7, shock: '#3a3d4c' },
  'springs.bouncy': { lift: 30, coil: '#ff6fd0', coilDark: '#b0268e', turns: 4, width: 30, thick: 6, shock: null },
};

export interface EngineLook {
  kind: 'vent' | 'scoop' | 'leaf' | 'turbo' | 'bolt';
  accent: string; accent2: string;
  /** Rear exhaust pipes: count (0 = none), thickness. */
  pipes: number; pipeW: number;
}
export const ENGINE: Record<VariantId, EngineLook> = {
  'engine.small': { kind: 'vent', accent: '#8d97a6', accent2: '#3a3d4c', pipes: 1, pipeW: 9 },
  'engine.big': { kind: 'scoop', accent: '#d7dde6', accent2: '#2a2a34', pipes: 2, pipeW: 13 },
  'engine.efficient': { kind: 'leaf', accent: '#3ccf5a', accent2: '#16803a', pipes: 1, pipeW: 7 },
  'engine.turbo': { kind: 'turbo', accent: '#ff8a1f', accent2: '#ffd21f', pipes: 2, pipeW: 16 },
  'engine.electric': { kind: 'bolt', accent: '#ffe23a', accent2: '#1f3fa0', pipes: 0, pipeW: 0 },
};

export interface GearLook {
  /** Number of gear wheels in the badge and their colours. */
  count: number; color: string; dark: string; teeth: number; size: number;
  /** Extra cue: none | chevrons | mountain | driveshaft. */
  cue: 'none' | 'chevrons' | 'mountain' | 'driveshaft';
}
export const GEAR: Record<VariantId, GearLook> = {
  'gears.easy': { count: 1, color: '#8fe08f', dark: '#2f8a3a', teeth: 8, size: 24, cue: 'none' },
  'gears.speedy': { count: 2, color: '#ff6a5c', dark: '#a31f2a', teeth: 10, size: 20, cue: 'chevrons' },
  'gears.climbing': { count: 1, color: '#ffa63a', dark: '#a85a00', teeth: 12, size: 30, cue: 'mountain' },
  'gears.fourByFour': { count: 1, color: '#b5bdca', dark: '#566074', teeth: 8, size: 22, cue: 'driveshaft' },
};

export interface BumperLook {
  /** Depth sticking out (x) and height (y) of the front bumper, colours. */
  depth: number; h: number; color: string; dark: string; kind: 'bar' | 'chrome' | 'rubber' | 'pusher';
  /** Rear bumper scale. */
  rear: number;
}
export const BUMPER: Record<VariantId, BumperLook> = {
  'bumpers.small': { depth: 12, h: 20, color: '#c3c9d4', dark: '#7a8394', kind: 'bar', rear: 1 },
  'bumpers.big': { depth: 24, h: 36, color: '#eef2f8', dark: '#8a93a4', kind: 'chrome', rear: 1 },
  'bumpers.rubber': { depth: 28, h: 34, color: '#2f3140', dark: '#14151f', kind: 'rubber', rear: 1 },
  'bumpers.pusher': { depth: 38, h: 52, color: '#ffb000', dark: '#6b4a00', kind: 'pusher', rear: 0.6 },
};

export interface ExtraLook { color: string; color2: string; color3: string }
export const EXTRA: Record<VariantId, ExtraLook> = {
  'extra.roofRack': { color: '#9aa3b0', color2: '#c98a4b', color3: '#ff7a3a' },
  'extra.rocket': { color: '#f2f2f8', color2: '#ee3b3b', color3: '#ffb02e' },
  'extra.floats': { color: '#ff8a1f', color2: '#ffffff', color3: '#1b1b3a' },
  'extra.spoiler': { color: '#2a2d3a', color2: '#ee3b3b', color3: '#c3c9d4' },
  'extra.snorkel': { color: '#3a3d4c', color2: '#8d97a6', color3: '#1b1b3a' },
  'extra.winch': { color: '#ffd21f', color2: '#c3c9d4', color3: '#3a3d4c' },
};

export const RACE_WINDOW = '#bfeaff';
export const RACE_WINDOW_DARK = '#6fb7e0';
