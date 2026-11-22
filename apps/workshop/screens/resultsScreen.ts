/**
 * results: every requirement of the challenge at the player's reading level with a green check or red X
 * (requirements in stages the run never reached are dimmed but still marked), a new-part line after a first
 * win, the hint after enough failed attempts, and Try again / Challenges / Workshop buttons.
 */
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { addBackdrop, addHeader } from '../ui/screenChrome';
import { COLORS, makeText } from '../ui/style';
import { currentProgress } from './room/progress';
import { getOutcome } from './run/outcome';

const resultsScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let group: FocusGroup | undefined;
  let challengeId = '';
  const objs: Phaser.GameObjects.GameObject[] = [];

  const toBoard = () => ctx.go('board');

  return {
    create(c: PaneContext, data: ScreenData) {
      ctx = c;
      challengeId = data.challengeId ?? '';
      const ws = ctx.workshop;
      const result = data.result;
      const challenge = ws ? currentProgress(ctx, ws).challenges[challengeId] : undefined;
      if (!ws || !result || !challenge) { toBoard(); return; }
      const reading = ctx.reading();
      const outcome = getOutcome(ctx.index);
      const { w, h } = ctx.size;
      const wide = ctx.layout === 'wide';
      const s = ctx.scene;

      objs.push(addBackdrop(ctx));
      ctx.audio.sting(result.passed ? 'success' : 'fail');
      objs.push(addHeader(ctx, result.passed ? 'It worked!' : 'Not yet!', 90, wide ? 110 : 84));
      objs.push(makeText(s, w / 2, 175, challenge.title, { size: wide ? 56 : 48, color: COLORS.paper, stroke: COLORS.ink, wrap: w - 80 }));

      // Requirement checklist.
      const reqs = challenge.stages.flatMap((st) => st.requirements);
      const byId = new Map(result.requirements.map((r) => [r.id, r]));
      const left = wide ? 260 : 70;
      const textW = w - left - (wide ? 260 : 60) - 90;
      let y = 260;
      const font = wide ? 48 : 42;
      for (const req of reqs) {
        const r = byId.get(req.id);
        const ok = !!r?.passed;
        const mark = makeText(s, left, y, ok ? '✓' : '✗', { size: font + 16, color: ok ? COLORS.green : COLORS.red, stroke: COLORS.paper, strokeW: 8, origin: [0, 0] });
        const line = makeText(s, left + 90, y + 6, req.text[reading], { size: font, color: COLORS.ink, wrap: textW, origin: [0, 0], bold: false });
        if (r && !r.reached) { mark.setAlpha(0.55); line.setAlpha(0.55); }
        objs.push(mark, line);
        y += Math.max(line.height, font + 16) + 26;
      }

      // New part / hint.
      y += 10;
      if (outcome.unlocked.length) {
        const names = outcome.unlocked.map((id) => engine.catalog(ws).variants.find((v) => v.id === id)?.name ?? id).join(', ');
        ctx.scene.time.delayedCall(1200, () => ctx.audio.sting('unlock'));
        const t = makeText(s, w / 2, y, `New part: ${names}!`, { size: font + 8, color: COLORS.yellow, stroke: COLORS.ink, strokeW: 10, wrap: w - 80, origin: [0.5, 0] });
        objs.push(t);
        s.tweens.add({ targets: t, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        y += t.height + 20;
      }
      if (!result.passed && outcome.hint) {
        const t = makeText(s, w / 2, y, `Hint: ${outcome.hint}`, { size: font, color: COLORS.ink, wrap: w - 120, origin: [0.5, 0] });
        const bg = s.add.rectangle(w / 2, y + t.height / 2, t.width + 60, t.height + 30, COLORS.yellow).setStrokeStyle(6, COLORS.ink);
        objs.push(bg, t);
        t.setDepth(1);
      }

      // Buttons.
      const by = h - 110;
      const bw = wide ? 460 : 280;
      const gap = wide ? 500 : 300;
      const again = new Button(s, { x: w / 2 - gap, y: by, w: bw, h: 140, label: 'Try again', fontSize: wide ? 56 : 44, color: COLORS.yellow, onClick: () => ctx.go('run', { challengeId }) });
      const board = new Button(s, { x: w / 2, y: by, w: bw, h: 140, label: 'Challenges', fontSize: wide ? 56 : 44, color: 0xbfe3ff, onClick: toBoard });
      const room = new Button(s, { x: w / 2 + gap, y: by, w: bw, h: 140, label: 'Workshop', fontSize: wide ? 56 : 44, color: 0xa8e6a1, onClick: () => ctx.go('room', { from: 'center' }) });
      objs.push(again, board, room);
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      group.set([again, board, room]);
      group.focus(result.passed ? board : room);
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (a === 'back') toBoard();
        else group?.handle(a);
      }
    },
    destroy() {
      group?.destroy();
      group = undefined;
      objs.forEach((o) => o.destroy());
      objs.length = 0;
    },
  };
};

export default resultsScreen;
