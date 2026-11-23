/**
 * Dino Lab look tables: ONE description per variant, keyed by VariantId. Side and top drawings are
 * both generated from these numbers. Units: design px of a MEDIUM dino, +x forward, y down, ground y = 0.
 * Codex: tweak numbers/colours here; drawing code stays generic.
 */
import type { VariantId } from '../../core/types';

export interface SkinLook { main: string; dark: string; belly: string; light: string; accent: string; spots?: boolean }
export const SKIN: Record<VariantId, SkinLook> = {
  'color.orange': { main: '#ff941f', dark: '#bd4b0b', belly: '#ffe0a3', light: '#ffc15c', accent: '#79320d' },
  'color.green': { main: '#1e6338', dark: '#123e29', belly: '#c0dd87', light: '#5e9c60', accent: '#e8ad4a' },
  'color.sandy': { main: '#d9ae6c', dark: '#a8763a', belly: '#f6e2b4', light: '#ecc98c', accent: '#bb5763' },
  'color.blue': { main: '#4aa8ff', dark: '#2569c9', belly: '#cfeaff', light: '#8ccaff', accent: '#ff8261' },
  'color.purple': { main: '#a55be0', dark: '#6d2fa8', belly: '#e8cdfb', light: '#c996f2', accent: '#65ddba' },
  'color.spotted': { main: '#f6c453', dark: '#d08a1c', belly: '#fff0c4', light: '#ffe08a', accent: '#b3541c', spots: true },
};

export interface HeadLook {
  len: number; top: number; jaw: number; neckLen: number;
  /** Neck direction (radians, negative = up) in crawl / standing poses. */
  neckAngCrawl: number; neckAngStand: number;
  eye: number; horns: number; noseHorn: boolean; crest: number; brow: boolean; snout: number;
}
export const HEAD: Record<VariantId, HeadLook> = {
  'head.round': { len: 98, top: 80, jaw: 26, neckLen: 44, neckAngCrawl: -0.5, neckAngStand: -0.75, eye: 11, horns: 0, noseHorn: false, crest: 0, brow: false, snout: 0.2 },
  'head.horned': { len: 106, top: 82, jaw: 26, neckLen: 44, neckAngCrawl: -0.45, neckAngStand: -0.7, eye: 10, horns: 62, noseHorn: true, crest: 0, brow: false, snout: 0.2 },
  'head.longNeck': { len: 80, top: 56, jaw: 20, neckLen: 205, neckAngCrawl: -1.15, neckAngStand: -1.3, eye: 9, horns: 0, noseHorn: false, crest: 0, brow: false, snout: 0.3 },
  'head.crest': { len: 104, top: 74, jaw: 24, neckLen: 56, neckAngCrawl: -0.65, neckAngStand: -0.85, eye: 10, horns: 0, noseHorn: false, crest: 84, brow: false, snout: 0.45 },
  'head.rex': { len: 172, top: 110, jaw: 46, neckLen: 58, neckAngCrawl: -0.3, neckAngStand: -0.4, eye: 12, horns: 0, noseHorn: false, crest: 0, brow: true, snout: 0.35 },
};

export interface TeethLook { kind: 'flat' | 'big' | 'sharp' | 'beak' | 'mega'; n: number; h: number; w: number; color: string }
export const TEETH: Record<VariantId, TeethLook> = {
  'teeth.flat': { kind: 'flat', n: 5, h: 9, w: 12, color: '#ffffff' },
  'teeth.big': { kind: 'big', n: 3, h: 20, w: 17, color: '#fffbe8' },
  'teeth.sharp': { kind: 'sharp', n: 9, h: 18, w: 11, color: '#ffffff' },
  'teeth.beak': { kind: 'beak', n: 0, h: 0, w: 0, color: '#ffc83a' },
  'teeth.mega': { kind: 'mega', n: 6, h: 34, w: 17, color: '#fffbe8' },
};

export interface BeakLook {
  name: string;
  base: number;
  reach: number;
  rise: number;
  hook: number;
  width: number;
  lower: number;
}

/** Proportions shared by the side and top drawings. Only the first profile ships on the model. */
export const BEAK_LOOKS = [
  { name: 'Short and curved', base: 0.58, reach: 1.14, rise: 0.53, hook: 0.20, width: 0.54, lower: 0.27 },
  { name: 'Wide duckbill', base: 0.61, reach: 1.27, rise: 0.24, hook: 0.04, width: 0.77, lower: 0.21 },
  { name: 'Long and pointed', base: 0.67, reach: 1.40, rise: 0.21, hook: 0.02, width: 0.42, lower: 0.13 },
  { name: 'Tall parrot beak', base: 0.65, reach: 1.25, rise: 0.73, hook: 0.42, width: 0.59, lower: 0.28 },
] as const satisfies readonly BeakLook[];

export interface ClawLook { kind: 'small' | 'hooks' | 'digging' | 'grabby' | 'tiny'; arm: number; thick: number; claw: number; color: string }
export const CLAWS: Record<VariantId, ClawLook> = {
  'claws.small': { kind: 'small', arm: 46, thick: 20, claw: 11, color: '#fffbe8' },
  'claws.hooks': { kind: 'hooks', arm: 50, thick: 20, claw: 26, color: '#ffe9a8' },
  'claws.digging': { kind: 'digging', arm: 54, thick: 26, claw: 32, color: '#8a5a32' },
  'claws.grabby': { kind: 'grabby', arm: 64, thick: 20, claw: 0, color: '#ffffff' },
  'claws.tinyArms': { kind: 'tiny', arm: 36, thick: 14, claw: 13, color: '#fffbe8' },
};

export interface LegLook { len: number; thick: number; foot: number; kind: 'plain' | 'powerful' | 'hoppy' | 'flipper' }
export const LEGS: Record<VariantId, LegLook> = {
  'legs.short': { len: 50, thick: 36, foot: 44, kind: 'plain' },
  'legs.long': { len: 130, thick: 24, foot: 46, kind: 'plain' },
  'legs.powerful': { len: 104, thick: 50, foot: 62, kind: 'powerful' },
  'legs.hoppy': { len: 100, thick: 28, foot: 74, kind: 'hoppy' },
  'legs.flippers': { len: 66, thick: 28, foot: 74, kind: 'flipper' },
};

export type Pose = 'crawl' | 'stand' | 'fly' | 'swim';
export const MOVE_POSE: Record<VariantId, Pose> = { 'move.crawl': 'crawl', 'move.stand': 'stand', 'move.fly': 'fly', 'move.swim': 'swim' };

export interface TailLook { len: number; base: number; tip: number; kind: 'plain' | 'club' | 'spiked' | 'paddle'; droop: number }
export const TAIL: Record<VariantId, TailLook> = {
  'tail.short': { len: 92, base: 36, tip: 8, kind: 'plain', droop: 10 },
  'tail.long': { len: 240, base: 32, tip: 5, kind: 'plain', droop: 26 },
  'tail.heavy': { len: 160, base: 56, tip: 34, kind: 'club', droop: 20 },
  'tail.spiked': { len: 150, base: 34, tip: 18, kind: 'spiked', droop: 12 },
  'tail.paddle': { len: 140, base: 28, tip: 8, kind: 'paddle', droop: 4 },
};

export interface BodyLook { rx: number; ry: number; kind: 'round' | 'slim' | 'armor' | 'sail' | 'belly'; accent: string }
export const BODY: Record<VariantId, BodyLook> = {
  'body.round': { rx: 112, ry: 82, kind: 'round', accent: '#ffffff' },
  'body.slim': { rx: 132, ry: 56, kind: 'slim', accent: '#ffffff' },
  'body.armored': { rx: 112, ry: 80, kind: 'armor', accent: '#8d97a6' },
  'body.sail': { rx: 112, ry: 74, kind: 'sail', accent: '#ff5a7a' },
  'body.belly': { rx: 112, ry: 100, kind: 'belly', accent: '#ffffff' },
};

export const SIZE_SCALE: Record<VariantId, number> = { 'size.small': 0.7, 'size.medium': 1, 'size.big': 1.35, 'size.huge': 1.8 };

export interface ExtraLook { kind: 'feathers' | 'frill' | 'glow' | 'camo' | 'stripes'; c1: string; c2: string; c3: string }
export const EXTRA: Record<VariantId, ExtraLook> = {
  'extra.feathers': { kind: 'feathers', c1: '#ff4d6d', c2: '#ffd21f', c3: '#3ac7ff' },
  'extra.frill': { kind: 'frill', c1: '#f4777a', c2: '#ffd09a', c3: '#bd4e65' },
  'extra.glow': { kind: 'glow', c1: '#f3ff7a', c2: '#c4ff3a', c3: '#ffffff' },
  'extra.camo': { kind: 'camo', c1: '#2f7a2a', c2: '#6bbf45', c3: '#1f5a1f' },
  'extra.stripes': { kind: 'stripes', c1: '#2a1a14', c2: '#2a1a14', c3: '#2a1a14' },
};

export const EYE_WHITE = '#ffffff';
