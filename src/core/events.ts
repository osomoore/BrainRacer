/**
 * Typed event bus — the ONLY way systems talk to each other. Orchestrator-owned contract.
 * Usage:  bus.on('challenge:resolved', (e) => ...);  bus.emit('goal:completed', {...});
 * RaceScene calls bus.clear() on shutdown so listeners never leak between races.
 */
import type {
  AnswerSlot, CameraLayout, Challenge, ChallengeResult, InputDevice, PlayerId,
  RewardKind, RoundResults, Vec2,
} from './types';

export interface GoalState {
  id: number;
  x: number;
  y: number;
  radius: number;
  placeWord?: string;     // e.g. "bakery" — shown in HUD with its icon
  sceneId?: string;       // icon image for the HUD
}

export type CrashWith = 'building' | 'traffic' | 'police' | 'player' | 'prop' | 'dino';

export interface GameEvents {
  // challenges
  'challenge:shown': { challenge: Challenge };
  'challenge:resolved': { challenge: Challenge; result: ChallengeResult; chosen: AnswerSlot | null };
  'place:near': { player: PlayerId; word: string };

  // scoring / rewards
  'score:changed': { team: number; perPlayer: number[] };
  'reward:granted': { player: PlayerId; reward: RewardKind; durationSec: number };
  'reward:ended': { player: PlayerId; reward: RewardKind };

  // goals
  'goal:spawned': { goal: GoalState };
  'goal:arrived': { goal: GoalState; player: PlayerId; waitSec: number };
  'goal:completed': { goal: GoalState; arrived: PlayerId[] };

  // vehicles / world
  'vehicle:crash': { player: PlayerId | null; with: CrashWith; impact: number; x: number; y: number };
  'jump:start': { player: PlayerId | null; x: number; y: number; airSec: number };
  'jump:request': { player: PlayerId; airSec: number; boost?: boolean };
  'jump:land': { player: PlayerId | null; x: number; y: number };

  // police
  'heat:changed': { player: PlayerId; heat: number };
  'police:chase': { player: PlayerId; count: number };
  'police:bump': { player: PlayerId; x: number; y: number };
  'police:lost': { player: PlayerId };

  // dino
  'dino:spawned': { x: number; y: number };
  'dino:roar': { x: number; y: number };
  'dino:step': { x: number; y: number };
  'dino:hit': { player: PlayerId; x: number; y: number };
  'dino:squash': { x: number; y: number };

  // round
  'round:start': { lengthSec: number };
  'round:tick': { remainingSec: number };
  'round:half': Record<string, never>;
  'round:end': { results: RoundResults };
  'game:pause': { by: PlayerId | null };
  'game:resume': Record<string, never>;

  // camera / ui
  'camera:layout': { layout: CameraLayout };
  'ui:banner': { text: string; color?: string; durationSec?: number };
  'ui:popup': { player: PlayerId; text: string; world?: Vec2; color?: string };

  // input
  'input:connected': { device: InputDevice };
  'input:disconnected': { device: InputDevice };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => this.off(type, fn);
  }

  once<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off<K extends keyof GameEvents>(type: K, fn: Handler<K>): void {
    this.handlers.get(type)?.delete(fn);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] handler for ${String(type)} threw`, err); }
    }
  }

  clear(): void { this.handlers.clear(); }
}

/** Global bus instance. */
export const bus = new EventBus();
