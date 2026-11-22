/**
 * run: plays the test run of `data.challengeId` with the current model (engine decides pass/fail first,
 * the runner acts it out), records the win/fail (not in Admin Mode), then opens results.
 * A / confirm toggles fast-forward (4x). B skips straight to the results.
 */
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { RunResult } from '../core/types';
import { engine } from '../logic';
import { playRun, type RunHandle } from '../run/runner';
import { currentProgress } from './room/progress';
import { setOutcome } from './run/outcome';

const FAST = 4;

const runScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let handle: RunHandle | undefined;
  let result: RunResult;
  let challengeId = '';
  let finished = false;
  let fast = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    const ws = ctx.workshop!;
    const save = ctx.save();
    const progress = currentProgress(ctx, ws);
    const challenge = progress.challenges[challengeId];
    let outcome = { unlocked: [] as string[], hint: null as string | null, firstWin: false };
    if (!ctx.adminMode && challenge) {
      if (result.passed) {
        const win = engine.recordWin(ws, progress, challengeId, progress.model, Date.now());
        ctx.commit({ ...save, workshops: { ...save.workshops, [ws]: win.progress } });
        outcome = { unlocked: win.unlocked, hint: null, firstWin: win.firstWin };
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
      fast = false;
      challengeId = data.challengeId ?? '';
      const ws = ctx.workshop;
      const progress = ws ? currentProgress(ctx, ws) : undefined;
      const challenge = progress?.challenges[challengeId];
      if (!ws || !progress || !challenge) { ctx.go('board'); return; }
      result = engine.evaluate(ws, progress.model, challenge);
      handle = playRun({
        scene: ctx.scene, origin: { x: 0, y: 0 }, size: ctx.size, workshop: ws, model: progress.model,
        challenge, result, audio: ctx.audio, buildRig: ctx.buildRig, seed: challenge.seed,
      });
      void handle.done.then(() => { if (handle) ctx.scene.time.delayedCall(400, finish); });
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (a === 'confirm') { fast = !fast; handle?.setSpeed(fast ? FAST : 1); }
        else if (a === 'back') finish();
      }
    },
    destroy() {
      const h = handle;
      handle = undefined;
      h?.destroy();
    },
  };
};

export default runScreen;
