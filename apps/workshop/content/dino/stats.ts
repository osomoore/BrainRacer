/** Dino Lab stats. Kids never see the numbers; requirements check them (stat = clamp(base + sum of parts)). */
import type { StatDef } from '../../core/types';

const s = (id: string, label: string, base: number): StatDef => ({ id, label, base, min: 0, max: 14 });

export const DINO_STATS: readonly StatDef[] = [
  s('speed', 'Speed (run, chase)', 3),
  s('jump', 'Jump height', 1),
  s('reach', 'Reach / how tall it stands', 1),
  s('climb', 'Climbing', 1),
  s('swim', 'Swimming', 0),
  s('strength', 'Strength (push, shake)', 2),
  s('bite', 'Gulp power (critters)', 1),
  s('crunch', 'Crunch (crack nuts, shells)', 1),
  s('dig', 'Digging', 0),
  s('size', 'Body size (small 1, medium 3, big 5, huge 7)', 3),
  s('stealth', 'Sneakiness (hiding)', 2),
  s('toughness', 'Toughness (bonks bounce off)', 1),
  s('warmth', 'Warmth (snow; hot in the desert)', 0),
  s('loudness', 'Loudness (roar, honk, rattle)', 1),
];
