/**
 * Run runner: plays a challenge's stages 0..result.endStage inside a rectangular area of a Phaser scene.
 *
 *   const run = playRun({ scene, origin: {x, y}, size: {w, h}, workshop, model, challenge, result, audio, buildRig, seed });
 *   run.setSpeed(3);        // hold-to-fast-forward (1 = normal); applies scene-wide tween/timer speed
 *   await run.done;         // resolves after the last stage (the final frame stays on screen)
 *   run.destroy();          // always call when leaving the run screen: kills tweens/timers/loops, destroys everything
 *
 * Players are found by glob: `./race/*.ts` and `./dino/*.ts` (default export = ScenarioPlayer). A scenario without a
 * player uses the generic fallback. Pass/fail is decided in `result`; nothing here depends on physics or frame rate.
 */
import Phaser from 'phaser';
import { WS_RUN } from '../config';
import { Rng } from '../core/rng';
import type { BuildRig, ModelRig, WorkshopAudio, WsSfx } from '../core/runtime';
import type { Challenge, Model, RunResult, WorkshopId } from '../core/types';
import { engine } from '../logic';
import { puffTexture } from './common/fx';
import { genericPlayer } from './common/generic';
import { type StageStep, planRun } from './common/plan';
import type { ScenarioPlayer, StageContext } from './types';

export interface RunOpts {
  scene: Phaser.Scene;
  /** Top-left of the visible run area in scene coordinates, and its size (1920x1080 or 960x1080). */
  origin: { x: number; y: number };
  size: { w: number; h: number };
  workshop: WorkshopId;
  model: Model;
  challenge: Challenge;
  result: RunResult;
  audio: WorkshopAudio;
  buildRig: BuildRig;
  seed: number;
}

export interface RunHandle {
  readonly done: Promise<void>;
  /** 1 = normal; > 1 fast-forwards (tweens, timers). Safe to call every frame. */
  setSpeed(mult: number): void;
  destroy(): void;
}

const modules = import.meta.glob<ScenarioPlayer>(['./race/*.ts', './dino/*.ts', '!./**/*.test.ts'], { eager: true, import: 'default' });
const PLAYERS = new Map<string, ScenarioPlayer>();
for (const p of Object.values(modules)) if (p && typeof p.play === 'function') PLAYERS.set(`${p.workshop}:${p.scenario}`, p);

/** The player for a scenario (generic fallback when missing). */
export function playerFor(workshop: WorkshopId, scenario: string): ScenarioPlayer {
  return PLAYERS.get(`${workshop}:${scenario}`) ?? genericPlayer(workshop, scenario);
}

export function playRun(o: RunOpts): RunHandle {
  const { scene, size } = o;
  const root = scene.add.container(o.origin.x, o.origin.y);
  const prevTween = scene.tweens.timeScale, prevTime = scene.time.timeScale;
  let dead = false;
  let speed = 1;
  const tweens = new Set<Phaser.Tweens.Tween>();
  const timers = new Set<Phaser.Time.TimerEvent>();
  const loops = new Set<() => void>();
  const layers = new Set<Phaser.GameObjects.Container>();
  const rigs = new Set<ModelRig>();

  const audio: WorkshopAudio = {
    music: (t) => o.audio.music(t),
    sfx: (n: WsSfx, opts) => o.audio.sfx(n, opts),
    sting: (n) => o.audio.sting(n),
    loop: (n, opts) => { const stop = o.audio.loop(n, opts); const wrapped = () => { loops.delete(wrapped); stop(); }; loops.add(wrapped); return wrapped; },
  };
  const stopLoops = (): void => { for (const s of [...loops]) s(); loops.clear(); };

  // ------------------------------------------------------------------ stage indicator (dots, no words)
  const dots: Phaser.GameObjects.Arc[] = [];
  const dotBar = scene.add.container(size.w / 2, 46);
  const nStages = o.challenge.stages.length;
  if (nStages > 1) {
    const gap = 52;
    for (let i = 0; i < nStages; i++) {
      const d = scene.add.circle((i - (nStages - 1) / 2) * gap, 0, 18, 0xffffff).setStrokeStyle(6, 0x1b1b3a);
      dots.push(d); dotBar.add(d);
    }
  }
  dotBar.setDepth(1000);
  root.add(dotBar);
  const setDots = (cur: number): void => dots.forEach((d, i) => d.setFillStyle(i < cur ? PAL_GREEN : i === cur ? PAL_YELLOW : 0xffffff));

  // ------------------------------------------------------------------ one stage
  const makeCtx = (step: StageStep, layer: Phaser.GameObjects.Container, rig: ModelRig, gate: Promise<void>): StageContext => {
    const stageReqIds = new Set(step.stage.requirements.map((r) => r.id));
    const wait = async (ms: number): Promise<void> => {
      await gate;
      if (dead) return new Promise<void>(() => {});
      return new Promise<void>((res) => { const t = scene.time.delayedCall(ms, () => { timers.delete(t); res(); }); timers.add(t); });
    };
    const tween = async (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> => {
      await gate;
      if (dead) return new Promise<void>(() => {});
      return new Promise<void>((res) => {
        const prevDone = config.onComplete;
        const tw = scene.tweens.add({ ...config, onComplete: (...a: unknown[]) => { tweens.delete(tw); (prevDone as ((...x: unknown[]) => void) | undefined)?.(...a); res(); } });
        tweens.add(tw);
        if (config.repeat === -1) res();
      });
    };
    return {
      scene, layer, size: { w: size.w, h: size.h }, groundY: Math.round(size.h * 0.78),
      workshop: o.workshop, model: o.model, computed: engine.computeModel(o.workshop, o.model),
      stage: step.stage, stageIndex: step.index, stageCount: nStages,
      result: step.result, requirements: o.result.requirements.filter((r) => stageReqIds.has(r.id)),
      rig, audio, rng: new Rng((o.seed + step.index * 7919) >>> 0 || 1), wait, tween,
    };
  };

  const dustPuff = (x: number, y: number): void => {
    const key = puffTexture(scene);
    const em = scene.add.particles(x, y, key, { speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 }, lifespan: 600, scale: { start: 1.6, end: 3.4 }, alpha: { start: 0.9, end: 0 }, tint: 0xf2e9d8, emitting: false });
    root.add(em); em.explode(10);
    scene.time.delayedCall(900, () => { if (em.scene) em.destroy(); });
  };

  // No geometry mask: the pane camera viewport already clips whatever slides or rolls outside the run area.
  const transition = async (prev: Phaser.GameObjects.Container | null, next: Phaser.GameObjects.Container, step: StageStep): Promise<void> => {
    const { w, h } = size;
    if (!prev) {
      next.setAlpha(0);
      await tw({ targets: next, alpha: 1, duration: 250 });
      return;
    }
    if (step.transition === 'roll') {
      const hy = Math.round(h * 0.6), sec = WS_RUN.viewRollSec * 1000, flat = 0.1;
      const st = { t: 0 };
      next.setAlpha(0);
      audio.sfx('whoosh');
      scene.time.delayedCall(sec * 0.5, () => dustPuff(w / 2, hy));
      const apply = (): void => {
        const t = st.t, so = 1 - t * (1 - flat), sn = flat + t * (1 - flat);
        prev.setScale(1, so).setPosition(0, hy * (1 - so)).setAlpha(Math.max(0, 1 - t * 1.6));
        next.setScale(1, sn).setPosition(0, hy * (1 - sn)).setAlpha(Math.max(0, (t - 0.35) * 1.6));
      };
      apply();
      await tw({ targets: st, t: 1, duration: sec, ease: 'Sine.easeInOut', onUpdate: apply });
      next.setScale(1).setPosition(0, 0).setAlpha(1);
    } else {
      const sec = WS_RUN.wipeSec * 1000;
      next.setPosition(w, 0);
      audio.sfx('whoosh', { volume: 0.5, rate: 1.3 });
      await Promise.all([tw({ targets: prev, x: -w, duration: sec, ease: 'Cubic.easeInOut' }), tw({ targets: next, x: 0, duration: sec, ease: 'Cubic.easeInOut' })]);
    }
  };

  /** Run-level tween (transitions); tracked so destroy() can stop it. */
  const tw = (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> => new Promise<void>((res) => {
    const t = scene.tweens.add({ ...config, onComplete: () => { tweens.delete(t); res(); } });
    tweens.add(t);
  });

  /** Stop the previous stage's tweens, timers and sound loops (its objects stay until the transition ends). */
  const quiet = (): void => {
    stopLoops();
    for (const t of [...tweens]) t.stop();
    tweens.clear();
    for (const t of timers) t.remove(false);
    timers.clear();
  };

  const steps = planRun(o.challenge, o.result);
  const done = (async () => {
    let prevLayer: Phaser.GameObjects.Container | null = null;
    let prevRig: ModelRig | null = null;
    for (const step of steps) {
      if (dead) return;
      quiet();
      setDots(step.index);
      const layer = scene.add.container(0, 0);
      layers.add(layer);
      root.add(layer);
      root.bringToTop(dotBar);
      const rig = o.buildRig(scene, o.workshop, o.model, step.stage.view);
      rigs.add(rig);
      layer.add(rig.root);
      rig.root.setPosition(step.stage.view === 'side' ? size.w * 0.2 : size.w * 0.5, step.stage.view === 'side' ? Math.round(size.h * 0.78) : size.h * 0.5);
      const gate = transition(prevLayer, layer, step);
      const ctx = makeCtx(step, layer, rig, gate);
      const player = playerFor(o.workshop, step.stage.scenario);
      const playing = Promise.resolve().then(() => player.play(ctx));
      await gate;
      if (dead) return;
      if (prevLayer) { layers.delete(prevLayer); prevLayer.destroy(); }
      if (prevRig) { rigs.delete(prevRig); prevRig.destroy(); }
      try { await playing; } catch (e) { if (!dead) console.error('run player failed', step.stage.scenario, e); }
      if (dead) return;
      prevLayer = layer; prevRig = rig;
    }
    setDots(nStages);
  })();

  const handle: RunHandle = {
    done,
    setSpeed(mult: number): void {
      if (dead || mult === speed) return;
      speed = mult;
      scene.tweens.timeScale = prevTween * mult;
      scene.time.timeScale = prevTime * mult;
    },
    destroy(): void {
      if (dead) return;
      dead = true;
      scene.tweens.timeScale = prevTween;
      scene.time.timeScale = prevTime;
      stopLoops();
      for (const t of [...tweens]) t.stop();
      tweens.clear();
      for (const t of timers) t.remove(false);
      timers.clear();
      for (const r of [...rigs]) r.destroy();
      rigs.clear();
      for (const l of [...layers]) l.destroy();
      layers.clear();
      root.destroy();
    },
  };
  return handle;
}

const PAL_GREEN = 0x2fb84f;
const PAL_YELLOW = 0xffd23f;
