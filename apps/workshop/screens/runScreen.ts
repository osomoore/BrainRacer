/**
 * run: plays the test run of `data.challengeId` with the current model (engine decides pass/fail first,
 * the runner acts it out), records the win/fail (not in Admin Mode), then opens results.
 * A / confirm toggles fast-forward (4x, shown as a ">>" icon). B skips straight to the results (once).
 * Input is ignored for the first INPUT_GUARD_MS so a button held from the board / results does not trigger anything.
 */
import type Phaser from 'phaser';
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { RunResult } from '../core/types';
import { engine } from '../logic';
import { playRun, type RunHandle } from '../run/runner';
import { currentProgress } from './room/progress';
import { setOutcome } from './run/outcome';
import { fastForwardTexture } from './run/ffIcon';

const FAST = 4;
/** Ignore input this long after the run opens (ms). */
const INPUT_GUARD_MS = 300;
/** Pause after the last stage animation before the results open (ms of scene time). */
const END_PAUSE_MS = 400;

const runScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let handle: RunHandle | undefined;
  let result: RunResult;
  let challengeId = '';
  let finished = false;
  let destroyed = false;
  let fast = false;
  let age = 0;
  let endTimer: Phaser.Time.TimerEvent | undefined;
  let icon: Phaser.GameObjects.Image | undefined;
  let iconTween: Phaser.Tweens.Tween | undefined;

  const setFast = (on: boolean) => {
    fast = on;
    handle?.setSpeed(on ? FAST : 1);
    icon?.setVisible(on);
  };

  const finish = () => {
    if (finished || destroyed) return;
    finished = true;
    endTimer?.remove(false);
    endTimer = undefined;
    const ws = ctx.workshop!;
    const save = ctx.save();
    const progress = currentProgress(ctx, ws);
    const challenge = progress.challenges[challengeId];
    const outcome = { payout: 0, hint: null as string | null };
    if (!ctx.adminMode && challenge) {
      if (result.passed) {
        const win = engine.recordWin(ws, progress, challengeId, progress.model, Date.now());
        ctx.commit({ ...save, workshops: { ...save.workshops, [ws]: win.progress } });
        outcome.payout = win.payout;
        if (win.unlockedBuddy) ctx.queueBuddyUnlock(ws, win.unlockedBuddy);
      } else {
        const p = engine.recordFail(ws, progress, challengeId);
        ctx.commit({ ...save, workshops: { ...save.workshops, [ws]: p } });
        outcome.hint = engine.hint(p, challenge, result, ctx.reading());
      }
    }
    setOutcome(ctx.index, outcome);
    ctx.go('results', { challengeId, result });
  };

  return {
    create(c: PaneContext, data: ScreenData) {
      ctx = c;
      finished = false;
      destroyed = false;
      fast = false;
      age = 0;
      challengeId = data.challengeId ?? '';
      const ws = ctx.workshop;
      const progress = ws ? currentProgress(ctx, ws) : undefined;
      const challenge = progress?.challenges[challengeId];
      if (!ws || !progress?.active.includes(challengeId) || !challenge) { ctx.go('board'); return; }
      result = engine.evaluate(ws, progress.model, challenge);
      try {
        handle = playRun({
          scene: ctx.scene, origin: { x: 0, y: 0 }, size: ctx.size, workshop: ws, model: progress.model,
          challenge, result, audio: ctx.audio, buildRig: ctx.buildRig, seed: challenge.seed,
        });
      } catch (e) {
        console.error('run failed to start', e);
        handle = undefined;
        finish();
        return;
      }
      // Fast-forward indicator: a ">>" icon in the top-right corner (never a word).
      icon = ctx.scene.add.image(ctx.size.w - 90, 80, fastForwardTexture(ctx.scene)).setDepth(10_000).setVisible(false);
      iconTween = ctx.scene.tweens.add({ targets: icon, alpha: 0.6, duration: 350, yoyo: true, repeat: -1 });
      handle.done.then(() => {
        if (destroyed || finished) return;
        endTimer = ctx.scene.time.delayedCall(END_PAUSE_MS, finish);
      }, () => { if (!destroyed) finish(); });
    },
    update(dt: number) {
      age += dt;
      const actions = ctx.input.poll();
      if (age < INPUT_GUARD_MS || finished || destroyed) return;
      for (const a of actions) {
        if (a === 'confirm') setFast(!fast);
        else if (a === 'back') { finish(); break; }
      }
    },
    destroy() {
      destroyed = true;
      endTimer?.remove(false);
      endTimer = undefined;
      iconTween?.remove();
      iconTween = undefined;
      icon?.destroy();
      icon = undefined;
      const h = handle;
      handle = undefined;
      h?.destroy();
    },
  };
};

export default runScreen;
