/**
 * run: plays the test run of `data.challengeId` with the current model (engine decides pass/fail first,
 * the runner acts it out), records the win/fail (not in Admin Mode), then opens results.
 * A / confirm toggles fast-forward (4x, shown as a ">>" icon). B skips straight to the results (once).
 * Input is ignored for the first INPUT_GUARD_MS so a button held from the board / results does not trigger anything.
 */
import type Phaser from 'phaser';
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { Challenge, Model, RunResult } from '../core/types';
import { WS_AUDIO } from '../config';
import { engine } from '../logic';
import { playRun, type RunHandle } from '../run/runner';
import { recordFail } from '../logic/board';
import { failLines, failNotes } from '../logic/failHints';
import { recordLearningTry } from '../logic/learning';
import { setOutcome, type RunOutcome } from './run/outcome';
import { fastForwardTexture } from './run/ffIcon';
import { challengeTitle } from '../logic/wording';

const FAST = 4;
/** Ignore input this long after the run opens (ms). */
const INPUT_GUARD_MS = 300;
/** Pause after the last stage animation before the results open (ms of scene time). */
const END_PAUSE_MS = 400;

const runScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let handle: RunHandle | undefined;
  let result: RunResult;
  let testedCard: Challenge;
  let testedBuild: Model;
  let sandbox: boolean;
  let challengeId = '';
  let testTitle: string | undefined;
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
    const progress = save.workshops[ws];
    const challenge = progress?.challenges[challengeId];
    if (!progress || !challenge || sandbox !== ctx.adminMode || !progress.active.includes(challengeId)
      || progress.completed[challengeId] || JSON.stringify(challenge.stages) !== JSON.stringify(testedCard.stages)) {
      ctx.go('board');
      return;
    }
    const outcome: RunOutcome = { payout: 0, hint: null, failLines: [], testTitle };
    const commit = (next: typeof progress, at: number) => {
      const updated = { ...save, workshops: { ...save.workshops, [ws]: next } };
      ctx.commit(recordLearningTry(updated, challenge, result, testedBuild, at, !!outcome.hint || outcome.failLines.length > 0));
    };
    if (result.passed) {
      if (!sandbox) {
        const at = Date.now();
        const win = engine.recordWin(ws, progress, challengeId, testedBuild, at);
        if (win.firstWin) commit(win.progress, at);
        outcome.payout = win.payout;
        if (win.unlockedBuddy) ctx.queueBuddyUnlock(ws, win.unlockedBuddy);
      }
    } else {
      const catalog = engine.catalog(ws);
      const notes = failNotes(catalog, { ...progress, model: testedBuild }, challenge, result);
      const reading = ctx.reading();
      outcome.failLines = failLines(catalog, challenge, notes, reading);
      if (!sandbox) {
        const failed = recordFail(progress, challengeId, notes);
        if (!outcome.failLines.length) outcome.hint = engine.hint(failed, challenge, result, reading);
        commit(failed, Date.now());
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
      // The board persists the dealt cards before Test, and retries still use the same active card.
      // Read that snapshot without refreshing and re-solving the board on the launch frame.
      const progress = ws ? ctx.save().workshops[ws] : undefined;
      const challenge = progress?.challenges[challengeId];
      if (!ws || !progress?.active.includes(challengeId) || !challenge || progress.completed[challengeId]) { ctx.go('board'); return; }
      testTitle = ctx.reading() === 'starter' ? challengeTitle(challenge, 'starter') : undefined;
      testedCard = challenge;
      testedBuild = { ...progress.model };
      sandbox = ctx.adminMode;
      ctx.audio.music(WS_AUDIO.runMusic[ws]);
      result = engine.evaluate(ws, testedBuild, challenge);
      try {
        handle = playRun({
          scene: ctx.scene, origin: { x: 0, y: 0 }, size: ctx.size, workshop: ws, model: testedBuild,
          challenge, result, audio: ctx.audio, buildRig: ctx.buildRig, seed: challenge.seed,
          buddy: progress.buddies.selected,
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
