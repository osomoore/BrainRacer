/**
 * World trait mapping. Workshop stats are the computed totals with all parts installed.
 *
 * World trait   | Race Shop                         | Dino Lab
 * ------------- | --------------------------------- | ------------------------------------------
 * speed         | Speed                             | Speed
 * accel         | Power minus excess weight         | Strength
 * turn          | Handling                          | Smaller size
 * mud           | Mud grip, winch boosts weak builds| Climb and dig
 * snow          | Snow grip                         | Climb and warmth
 * rough         | Clearance and toughness           | Climb and toughness
 * water         | Clearance, snorkel, floaties      | Swim, flippers, paddle tail, swimming pose
 * light         | Rally lights                      | Glow spots
 * raised        | Clearance                        | Long legs
 * smash         | Push bumper                      | Horn head or heavy tail
 * width/height  | Width/height, including size      | Size, posture and reach (height only)
 * jump          | Bounce, speed, rocket             | Jump, wings/flying
 * push          | Push and surplus power, winch     | Strength
 * reach         | Height                            | Reach, long neck
 * dig           | No digging part                   | Dig, digging claws
 * stealth       | Low noise, dark or bright paint   | Stealth and camouflage
 * loud          | Noise                             | Loudness
 * heat          | Radiator                         | Neck frill, low warmth, desert camouflage
 * cold          | Snow grip                         | Warmth
 * carry         | Load, including roof rack         | Strength, size and bite (carrying grip)
 */
import { CATALOGS } from '../../workshop/content';
import { computeModel, partTag } from '../../workshop/logic/stats';
import { WORLD_DRIVE } from '../config';
import type { Creation, Traits } from '../core/types';

/** Thresholds for levels 1, 2 and 3. */
function level(value: number, ok: number, good: number, great: number): number {
  if (value >= great) return 3;
  if (value >= good) return 2;
  return value >= ok ? 1 : 0;
}

export function traitsOf(creation: Creation): Traits {
  const { stats: s, tags } = computeModel(CATALOGS[creation.workshop], creation.model);
  if (creation.workshop === 'race') {
    const drive = WORLD_DRIVE.car;
    const pushBumper = Number(tags.has(partTag('bumpers.pusher')));
    return {
      kind: 'car',
      speed: drive.speed + drive.speedPerStat * s.speed,
      accel: drive.accel + drive.accelPerStat * Math.max(0, s.power - Math.max(0, s.weight - 4) / 2),
      turn: drive.turn + drive.turnPerStat * s.handling,
      mud: level(Math.max(s.mudGrip, tags.has('winch') ? 3 : 0), 1, 3, 5),
      snow: level(s.snowGrip, 1, 3, 5),
      rough: level(2 * s.clearance + s.toughness, 3, 9, 13),
      water: tags.has('canFloat') ? 3 : tags.has('snorkel') ? 2 : Number(s.clearance >= 2),
      light: tags.has('glow') || tags.has('light') || tags.has('rallyLights') ? 3 : 0,
      raised: Number(s.clearance > 2),
      smash: pushBumper,
      pushBumper,
      width: 1 + level(s.width, 3, 5, 6),
      height: 1 + level(s.height, 3, 4, 6),
      jump: level(s.bounce + s.speed / 2 + (tags.has('rocket') ? 2 : 0), 2.5, 5, 7),
      push: level(s.push + Math.max(0, s.power - 3) / 2 + Number(tags.has('winch')), 1, 3, 5),
      reach: level(s.height, 2, 4, 6),
      dig: 0,
      stealth: level(6 - s.noise + 2 * Number(tags.has('dark')) - Number(tags.has('bright')), 2, 4, 6),
      loud: level(s.noise, 2, 5, 7),
      heat: tags.has('cooling') || tags.has('radiator') ? 3 : 0,
      cold: level(s.snowGrip, 1, 3, 5),
      carry: Math.max(1, level(s.load, 1, 5, 7)),
    };
  }

  const drive = WORLD_DRIVE.dino;
  const width = 1 + level(s.size, 3, 5, 7);
  const swimmingPart = tags.has('flippers') || tags.has('paddleTail') || tags.has('canSwim');
  const camouflaged = [...tags].some(tag => tag.startsWith('camo:'));
  return {
    kind: 'dino',
    speed: drive.speed + drive.speedPerStat * s.speed,
    accel: drive.accel + drive.accelPerStat * s.strength,
    turn: drive.turn + drive.turnPerSize * (2 - width),
    mud: level(s.climb + s.dig, 1, 4, 7),
    snow: level(s.climb + s.warmth / 2, 2, 4, 7),
    rough: level(s.climb + s.toughness, 2, 5, 8),
    water: Math.max(swimmingPart ? 2 : 0, level(s.swim, 1, 4, 7)),
    light: tags.has('glow') ? 3 : 0,
    raised: Number(tags.has(partTag('legs.long'))),
    smash: Number(tags.has('horns') || tags.has(partTag('tail.heavy'))),
    width,
    height: Math.min(4, width + Number(tags.has('pose:stand') || s.reach >= 5 || tags.has('longNeck'))),
    jump: Math.max(tags.has('canFly') || tags.has('wings') ? 3 : 0, level(s.jump, 1, 3, 5)),
    push: level(s.strength, 1, 4, 6),
    reach: Math.max(tags.has('longNeck') ? 3 : 0, level(s.reach, 1, 3, 5)),
    dig: Math.max(tags.has('digger') ? 3 : 0, level(s.dig, 1, 3, 5)),
    stealth: level(s.stealth + 2 * Number(camouflaged), 2, 5, 7),
    loud: level(s.loudness, 1, 3, 5),
    heat: tags.has('frill') ? 3 : Math.max(tags.has('camo:desert') ? 2 : 0, level(4 - s.warmth, 1, 2, 3)),
    cold: level(s.warmth, 2, 5, 7),
    carry: Math.max(1, level(s.strength + s.size / 2 + s.bite / 2, 1, 6, 10)),
  };
}
