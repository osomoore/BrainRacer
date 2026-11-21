// Pure (Phaser-free) decision helpers for the cruiser pile that chases a monster rider.
import { POLICE } from '../config/gameConfig';

export interface Pt { x: number; y: number }

/** How many cruisers to spawn right now so the pile reaches `count` (capped per top-up tick). */
export function swarmDeficit(
  alive: number, count: number = POLICE.monsterSwarmCount, perTick: number = POLICE.monsterSwarmTopUpBatch,
): number {
  return Math.max(0, Math.min(count - alive, perTick));
}

/** Lane nodes that may host a swarm spawn: in the ring around the boss, clear of players and other cars. */
export function swarmSpawnCandidates<N extends Pt & { next: number[] }>(
  nodes: readonly N[], boss: Pt, players: readonly Pt[], others: readonly Pt[],
  min: number = POLICE.monsterSwarmSpawnMinDist, max: number = POLICE.monsterSwarmSpawnMaxDist,
  playerClear: number = POLICE.monsterSwarmPlayerClear, otherClear: number = POLICE.monsterSwarmCarClear,
): N[] {
  return nodes.filter((n) => {
    if (n.next.length === 0) return false;
    const d = Math.hypot(n.x - boss.x, n.y - boss.y);
    if (d < min || d > max) return false;
    if (players.some((p) => Math.hypot(p.x - n.x, p.y - n.y) < playerClear)) return false;
    return !others.some((o) => Math.hypot(o.x - n.x, o.y - n.y) < otherClear);
  });
}

/** A chasing swarm car should be recycled (destroyed, then topped up closer) when lost or wedged far from the boss. */
export function shouldRecycleSwarmCar(distToBoss: number, stuckSec: number): boolean {
  if (distToBoss > POLICE.monsterSwarmRecycleDist) return true;
  return stuckSec >= POLICE.monsterSwarmStuckSec && distToBoss > POLICE.monsterSwarmStuckMinDist;
}

/** A leaving swarm car is removed once off every view, or when its short exit timer runs out. */
export function shouldDestroyLeavingSwarmCar(leaveSec: number, offscreen: boolean): boolean {
  return offscreen || leaveSec >= POLICE.monsterSwarmExitSec;
}
