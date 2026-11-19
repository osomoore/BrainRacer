import { TEX } from '../core/assetKeys';

/**
 * How to assemble the top-down dino in a Phaser Container (facing +x at angle 0).
 * Container origin = centre of the torso (the body texture centre). All offsets are in
 * container-local pixels at scale 1. Parts are added in ascending `depth` order
 * (container.add order or setDepth on children if you use a Layer).
 *
 * Usage:
 *   const c = scene.add.container(x, y);
 *   for (const p of Object.values(DINO_RIG.parts)) { const img = scene.add.image(p.x, p.y, p.key).setOrigin(p.originX, p.originY).setFlipY(!!p.flipY); c.add(img); }
 *   (sort by depth first). Legs: animate `legFrames` (see legs.*), wag the tail by rotating the tail image around
 *   its pivot (the origin already sits on the pivot) and bob the head slightly.
 */
export interface RigPart {
  key: string;
  /** Offset from container origin. */
  x: number;
  y: number;
  /** Texture origin; for tail/head/legs this is the pivot. */
  originX: number;
  originY: number;
  /** Draw order inside the container, ascending (low = underneath). */
  depth: number;
  flipY?: boolean;
}

export const DINO_RIG = {
  /** Approximate bounding length (tail tip to snout) and width for collision/scale reasoning. */
  length: 562,
  width: 160,
  /** Shadow goes under the container (separate image, not rotated with wag): centre offset from container origin. */
  shadow: { key: TEX.dinoShadow, x: -25, y: 10, originX: 0.5, originY: 0.5 } as const,
  parts: {
    /** Legs are drawn first (underneath the body). Swap texture through `legFrames` for a walk cycle. */
    legL: { key: TEX.dinoLeg[0], x: -8, y: -57, originX: 0.5, originY: 0.5, depth: 0, flipY: true } as RigPart,
    legR: { key: TEX.dinoLeg[0], x: -8, y: 57, originX: 0.5, originY: 0.5, depth: 0 } as RigPart,
    /** Tail pivot = right edge centre of the tail texture; it sits at the body's rear and trails toward -x. */
    tail: { key: TEX.dinoTail, x: -125, y: 0, originX: 1, originY: 0.5, depth: 1 } as RigPart,
    body: { key: TEX.dinoBody, x: 0, y: 0, originX: 0.5, originY: 0.5, depth: 2 } as RigPart,
    /** Head pivots at the back of the skull where it meets the neck end (body texture right edge = x 150). */
    head: { key: TEX.dinoHead, x: 138, y: 0, originX: 0.12, originY: 0.5, depth: 3 } as RigPart,
  },
  legs: {
    frames: TEX.dinoLeg,
    /** The right leg runs this many frames ahead of the left leg (alternating gait). */
    rightPhaseOffset: 2,
    /** Suggested ms per frame while walking at normal speed. */
    frameMs: 140,
  },
  /** Suggested tail wag amplitude in radians. */
  tailWag: 0.18,
} as const;
