import { WORLD_DRIVE as DRIVE } from '../config';
import type { Feature, Obstacle, SurfaceSample, Traits, Vec } from '../core/types';
import { featurePassable, obstaclePassable, surfaceEffect } from './rules';

export interface MoveState extends Vec {
  angle: number;
  vx: number;
  vy: number;
  /** Seconds left in the current jump. */
  airborne: number;
  /** Keep while stepping to avoid relaunching and to recover from blocked landings. */
  jump?: { id: string; takeoff: Vec };
}

export interface MoveInput extends Vec {
  /** Signed car throttle. Negative is reverse. */
  throttle: number;
  brake: number;
}

export interface NearbySolids {
  obstacles?: readonly Obstacle[];
  features?: readonly Feature[];
}

export interface MoveWorld {
  surfaceAt(x: number, y: number): SurfaceSample;
  /** Return solids whose collider or footprint intersects the query circle, including jump features. */
  nearbySolids(x: number, y: number, radius: number): NearbySolids;
}

export interface MoveResult extends MoveState {
  /** Once per obstacle per step. The caller applies world changes such as pushing or breaking. */
  obstacleEffects: { obstacle: Obstacle; effect: NonNullable<Obstacle['effect']> }[];
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Vec, amount: number): Vec => ({ x: v.x * amount, y: v.y * amount });
const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
const length = (v: Vec): number => Math.hypot(v.x, v.y);
const unit = (v: Vec): Vec => scale(v, 1 / (length(v) || 1));
const facing = (angle: number): Vec => ({ x: Math.cos(angle), y: Math.sin(angle) });
const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));
const approach = (value: number, target: number, amount: number): number => value + clamp(target - value, amount);

function drive(state: MoveState, input: MoveInput, traits: Traits, sample: SurfaceSample, dt: number) {
  const { speedMult, grip, passable } = surfaceEffect(traits.kind, sample, traits);
  // A restored position or a wider swapped build may start in blocked terrain.
  const control = passable ? grip : 1;
  const topSpeed = traits.speed * (passable ? speedMult : 1);
  const acceleration = traits.accel * control * dt;
  const maxTurn = traits.turn * control * dt;
  const velocity = { x: state.vx, y: state.vy };
  const brake = Math.max(0, clamp(input.brake, 1));
  if (traits.kind === 'dino') {
    const aim = { x: clamp(input.x, 1), y: clamp(input.y, 1) };
    const magnitude = Math.min(1, length(aim));
    const targetAngle = Math.atan2(aim.y, aim.x);
    const turn = targetAngle - state.angle;
    const angle = magnitude ? state.angle + clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), maxTurn) : state.angle;
    const target = scale(facing(angle), topSpeed * magnitude);
    const change = subtract(target, velocity);
    const amount = magnitude ? acceleration : acceleration * DRIVE.coastDeceleration;
    const next = add(velocity, scale(unit(change), Math.min(length(change), amount)));
    return { angle, velocity: scale(unit(next), Math.max(0, length(next) - brake * acceleration * DRIVE.brakeDeceleration)) };
  }

  const throttle = clamp(input.throttle, 1);
  const forwardSpeed = dot(velocity, facing(state.angle));
  const angle = state.angle + clamp(input.x, 1) * maxTurn * (Math.sign(forwardSpeed || throttle) || 1);
  const forward = facing(angle);
  const along = dot(velocity, forward);
  const lateral = subtract(velocity, scale(forward, along));
  const target = topSpeed * throttle * (throttle < 0 ? DRIVE.reverseSpeed : 1);
  const propelled = approach(along, target, acceleration * (throttle === 0 ? DRIVE.coastDeceleration : 1));
  const speed = approach(propelled, 0, brake * acceleration * DRIVE.brakeDeceleration);
  const slip = Math.max(0, length(lateral) - acceleration * DRIVE.lateralDeceleration);
  return { angle, velocity: add(scale(forward, speed), scale(unit(lateral), slip)) };
}

/** Outward normal of the nearest polygon edge when the circle touches or is inside the footprint. */
function polygonNormal(point: Vec, area: readonly Vec[], radius: number): Vec | undefined {
  let inside = false;
  let nearest: Vec = { x: 0, y: 0 };
  let edge: Vec = nearest;
  let distance = Infinity;
  let signedArea = 0;
  for (let i = 0; i < area.length; i++) {
    const a = area[i];
    const b = area[(i + 1) % area.length];
    const side = subtract(b, a);
    const offset = subtract(point, a);
    const size = dot(side, side);
    if (size === 0) continue;
    signedArea += a.x * b.y - a.y * b.x;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + side.x * offset.y / side.y) inside = !inside;
    const projection = Math.max(0, Math.min(1, dot(offset, side) / size));
    const difference = subtract(offset, scale(side, projection));
    const distanceSquared = dot(difference, difference);
    if (distanceSquared < distance) {
      distance = distanceSquared;
      nearest = difference;
      edge = side;
    }
  }
  if (!inside && distance > radius * radius) return;
  if (distance === 0) return unit(scale({ x: edge.y, y: -edge.x }, Math.sign(signedArea)));
  return unit(scale(nearest, inside ? -1 : 1));
}

function circleNormal(point: Vec, obstacle: Obstacle, radius: number): Vec | undefined {
  const offset = subtract(point, obstacle.at);
  return length(offset) <= radius + obstacle.radius ? unit(offset) : undefined;
}

function groundAt(world: MoveWorld, point: Vec, traits: Traits) {
  return surfaceEffect(traits.kind, world.surfaceAt(point.x, point.y), traits);
}

function featureBlocks(feature: Feature, traits: Traits, velocity: Vec, airborne: number): boolean {
  if (!featurePassable(feature, traits)) return true;
  return feature.kind === 'jump' && !!feature.needs?.length && airborne === 0
    && dot(unit(velocity), facing(feature.dir)) < DRIVE.jumpAlignment;
}

function collision(from: Vec, to: Vec, nearby: NearbySolids, world: MoveWorld, traits: Traits, radius: number, airborne: number) {
  const delta = subtract(to, from);
  for (const feature of nearby.features ?? []) {
    if (!featureBlocks(feature, traits, delta, airborne)) continue;
    const next = polygonNormal(to, feature.area, radius);
    const normal = polygonNormal(from, feature.area, radius) ?? next;
    if (next && normal && dot(delta, normal) < 0) return { normal, bounce: DRIVE.bounce };
  }
  if (airborne > 0) return;

  for (const obstacle of nearby.obstacles ?? []) {
    if (obstaclePassable(obstacle, traits)) continue;
    const next = circleNormal(to, obstacle, radius);
    const normal = circleNormal(from, obstacle, radius) ?? next;
    if (next && normal && dot(delta, normal) < 0) return { normal, bounce: DRIVE.bounce };
  }

  const ground = groundAt(world, to, traits);
  if (ground.passable || !groundAt(world, from, traits).passable) return;
  const xBlocked = !groundAt(world, { x: to.x, y: from.y }, traits).passable;
  const yBlocked = !groundAt(world, { x: from.x, y: to.y }, traits).passable;
  const normal = xBlocked === yBlocked ? scale(unit(delta), -1)
    : xBlocked ? { x: -Math.sign(delta.x), y: 0 } : { x: 0, y: -Math.sign(delta.y) };
  return { normal, bounce: ground.bounce ?? 0 };
}

function canLand(at: Vec, nearby: NearbySolids, world: MoveWorld, traits: Traits, radius: number): boolean {
  return groundAt(world, at, traits).passable
    && !(nearby.obstacles ?? []).some(obstacle => !obstaclePassable(obstacle, traits) && circleNormal(at, obstacle, radius))
    && !(nearby.features ?? []).some(feature => (feature.kind === 'jump' && !!feature.needs?.length
      || !featurePassable(feature, traits)) && polygonNormal(at, feature.area, radius));
}

/** Pure movement in world pixels. dt is elapsed seconds. Substeps bound tunneling at low frame rates. */
export function step(state: MoveState, input: MoveInput, traits: Traits, world: MoveWorld, dt: number): MoveResult {
  const effects = new Map<string, MoveResult['obstacleEffects'][number]>();
  if (!(dt > 0) || !Number.isFinite(dt)) return { ...state, obstacleEffects: [] };
  const radius = DRIVE.colliderRadius[traits.width - 1];
  let at: Vec = { x: state.x, y: state.y };
  let velocity = { x: state.vx, y: state.vy };
  let { angle, airborne, jump } = state;
  const count = Math.ceil(dt / Math.min(DRIVE.maxStepSeconds, DRIVE.maxStepDistance / Math.max(traits.speed, length(velocity))));
  const interval = dt / count;
  for (let i = 0; i < count; i++) {
    if (airborne === 0) {
      ({ angle, velocity } = drive({ ...at, angle, vx: velocity.x, vy: velocity.y, airborne },
        input, traits, world.surfaceAt(at.x, at.y), interval));
    }
    const nearby = world.nearbySolids(at.x, at.y, radius + Math.max(length(velocity), traits.speed) * interval);
    let to = add(at, scale(velocity, interval));
    if (airborne === 0) {
      if (jump && !nearby.features?.some(f => f.id === jump?.id && polygonNormal(at, f.area, radius))) jump = undefined;
      const ramp = nearby.features?.find(feature => feature.kind === 'jump' && feature.id !== jump?.id
        && featurePassable(feature, traits) && dot(unit(velocity), facing(feature.dir)) >= DRIVE.jumpAlignment
        && polygonNormal(to, feature.area, radius));
      if (ramp) {
        jump = { id: ramp.id, takeoff: at };
        airborne = DRIVE.jumpSeconds + traits.jump * DRIVE.jumpSecondsPerLevel;
        if (ramp.needs?.length) {
          velocity = scale(unit(velocity), Math.max(length(velocity), traits.speed * DRIVE.gapMinSpeed));
          to = add(at, scale(velocity, interval));
          const axis = facing(ramp.dir);
          const farLip = Math.max(...ramp.area.map(point => dot(subtract(point, at), axis)));
          airborne = Math.max(airborne, (farLip + radius + DRIVE.maxStepDistance) / dot(velocity, axis));
        }
      }
    }

    const hit = collision(at, to, nearby, world, traits, radius, airborne);
    if (hit) {
      const normalVelocity = scale(hit.normal, dot(velocity, hit.normal));
      const tangent = subtract(velocity, normalVelocity);
      const slide = add(at, scale(tangent, interval));
      if (!collision(at, slide, nearby, world, traits, radius, airborne)) at = slide;
      velocity = subtract(tangent, scale(normalVelocity, hit.bounce));
    } else {
      at = to;
    }

    if (airborne > 0) {
      airborne = Math.max(0, airborne - interval);
      if (airborne === 0 && jump && !canLand(at, nearby, world, traits, radius)) {
        at = jump.takeoff;
        velocity = scale(velocity, -DRIVE.bounce);
      }
      continue;
    }
    for (const obstacle of nearby.obstacles ?? []) {
      if (obstacle.effect && obstaclePassable(obstacle, traits) && circleNormal(at, obstacle, radius)) {
        effects.set(obstacle.id, { obstacle, effect: obstacle.effect });
      }
    }
  }
  return { x: at.x, y: at.y, angle, vx: velocity.x, vy: velocity.y, airborne, jump, obstacleEffects: [...effects.values()] };
}
