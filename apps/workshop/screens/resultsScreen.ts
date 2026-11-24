/**
 * results: every requirement of the challenge at the player's reading level with a green check or red X,
 * grouped by stage (stage number badges when there is more than one stage; stages the run never reached are dimmed
 * but still marked), a currency payout after a win, the hint after
 * enough failed attempts, and Run again / New Tests / Workshop buttons (Run again only after a fail).
 *
 * Long checklists shrink the font (never below 40 px), then are paged (the payout and the hint stay on every page).
 * Input is ignored for a moment after the screen opens so a held A from the run does not press a button.
 */
import type Phaser from 'phaser';
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { Challenge, Requirement, RunResult } from '../core/types';
import { WS_RESULTS, WS_UI } from '../config';
import { playWorkshopSfx } from '../audio';
import { currencyBadge } from '../ui/CurrencyBadge';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { addBackdrop, addHeader } from '../ui/screenChrome';
import { circleTexture, COLORS, makeText } from '../ui/style';
import { currentProgress } from './room/progress';
import { fitResults } from './results/layout';
import { getOutcome } from './run/outcome';

/** Ignore pad / key input this long after opening (a held A from the run screen). */
const INPUT_GUARD_MS = 400;

const resultsScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let group: FocusGroup | undefined;
  let pager: Pager | undefined;
  let challengeId = '';
  let age = 0;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const pageObjs: Phaser.GameObjects.GameObject[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];

  const toBoard = () => ctx.go('board');
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };

  interface Row { req: Requirement; stage: number; first: boolean; ok: boolean; reached: boolean }

  return {
    create(c: PaneContext, data: ScreenData) {
      ctx = c;
      age = 0;
      challengeId = data.challengeId ?? '';
      const ws = ctx.workshop;
      const result: RunResult | undefined = data.result;
      const progress = ws ? currentProgress(ctx, ws) : undefined;
      const challenge: Challenge | undefined = progress?.challenges[challengeId];
      if (!ws || !progress || !result || !challenge) { toBoard(); return; }
      const reading = ctx.reading();
      const outcome = getOutcome(ctx.index);
      const { w, h } = ctx.size;
      const wide = ctx.layout === 'wide';
      const s = ctx.scene;
      const min = WS_UI.minFont;

      keep(addBackdrop(ctx));
      ctx.audio.sting(result.passed ? 'success' : 'fail');
      keep(addHeader(ctx, result.passed ? 'It worked!' : 'Not yet!', wide ? 78 : 66, wide ? 100 : 72));
      const title = keep(makeText(s, w / 2, wide ? 184 : 152, challenge.title,
        { size: wide ? 56 : 48, color: COLORS.paper, stroke: COLORS.ink, wrap: w - 80 }));
      const titleBottom = title.y + title.height / 2;
      if (outcome.payout > 0) {
        keep(currencyBadge(s, ws, w / 2, titleBottom + 74, `+${outcome.payout}`, true).root);
        timers.push(s.time.delayedCall(850, () => playWorkshopSfx(ctx.audio, 'payout')));
      }

      // ---- geometry
      const top = Math.max(250, titleBottom + (outcome.payout > 0 ? 154 : 24));
      const fullBottom = 890;
      const pagerY = 830;
      const pagedBottom = 750;
      const gap = 16;
      const multi = challenge.stages.length > 1;
      const badgeX = wide ? 230 : 52;
      const markX = wide ? 300 : 96;
      const textX = wide ? 390 : 168;
      const textW = w - textX - (wide ? 200 : 36);
      const fonts = wide ? [48, 44, 40] : [44, 42, 40];

      // ---- rows (requirements grouped by stage)
      const byId = new Map(result.requirements.map((r) => [r.id, r]));
      const rows: Row[] = [];
      challenge.stages.forEach((st, si) => st.requirements.forEach((req, ri) => {
        const r = byId.get(req.id);
        rows.push({ req, stage: si, first: ri === 0, ok: !!r?.passed, reached: r ? r.reached : true });
      }));
      const rowGap = 22;
      const stageGap = 20;
      const rowExtra = (row: Row, i: number) => rowGap + (multi && row.first && i > 0 ? stageGap : 0);
      const measureRows = (font: number): number[] => rows.map((row, i) => {
        const t = makeText(s, 0, 0, row.req.text[reading], { size: font, wrap: textW, origin: [0, 0], bold: false, align: 'left' });
        const hh = Math.max(t.height, font + 16);
        t.destroy();
        return hh + rowExtra(row, i);
      });

      const hintText = !result.passed && outcome.hint
        ? keep(makeText(s, w / 2, 0, `Hint: ${outcome.hint}`, { size: 40, color: COLORS.ink, wrap: w - 150, origin: [0.5, 0] })).setDepth(1)
        : undefined;
      const hintHeight = hintText ? hintText.height + 30 : 0;

      const plan = fitResults({
        fonts,
        measure: (font) => ({ rows: measureRows(font), extras: hintHeight }),
        fullHeight: fullBottom - top,
        pagedHeight: pagedBottom - top,
        gap,
      });
      const font = plan.font;
      const pagesN = plan.pages.length;
      const rowHeights = measureRows(font);
      if (hintText) {
        const rowsBottom = top + rowHeights.reduce((sum, height) => sum + height, 0);
        const y = pagesN > 1 ? pagedBottom - hintHeight : Math.min(fullBottom - hintHeight, rowsBottom + gap);
        keep(s.add.rectangle(w / 2, y + hintHeight / 2, Math.min(w - 40, hintText.width + 60), hintHeight, COLORS.yellow)
          .setStrokeStyle(6, COLORS.ink));
        hintText.setY(y + 15);
      }

      // ---- one page of rows
      let page = 0;
      const drawPage = () => {
        pageObjs.forEach((o) => o.destroy());
        pageObjs.length = 0;
        let y = top;
        for (const i of plan.pages[page] ?? []) {
          const row = rows[i];
          if (multi && row.first && y > top) y += stageGap;
          if (multi && row.first) {
            const bx = badgeX, by = y + 34;
            const disc = s.add.image(bx, by, circleTexture(s, 64, row.reached ? COLORS.yellow : WS_RESULTS.unreachedBadge));
            const num = makeText(s, bx, by, String(row.stage + 1), { size: min, color: COLORS.ink });
            pageObjs.push(disc, num);
          }
          const mark = row.reached
            ? makeText(s, markX, y, row.ok ? '✓' : '✗', { size: font + 8, color: row.ok ? COLORS.green : COLORS.red, stroke: COLORS.paper, strokeW: 8, origin: [0, 0] })
            : makeText(s, markX, y, '–', { size: font + 8, color: WS_RESULTS.unreachedText, origin: [0, 0] });
          const line = makeText(s, textX, y + 6, row.req.text[reading], { size: font, color: row.reached ? COLORS.ink : WS_RESULTS.unreachedText, wrap: textW, origin: [0, 0], bold: false, align: 'left' });
          pageObjs.push(mark, line);
          y += rowHeights[i] - (multi && row.first && i > 0 ? stageGap : 0);
        }
      };
      drawPage();

      // ---- buttons
      const by = h - 100;
      const bw = wide ? 460 : 270;
      const gapX = wide ? 500 : 300;
      const fs = wide ? 56 : 44;
      const labels = result.passed ? ['New Tests', 'Workshop'] : ['Run again', 'New Tests', 'Workshop'];
      const xs = labels.map((_, i) => w / 2 + (i - (labels.length - 1) / 2) * gapX);
      const make = (i: number, color: number, onClick: () => void) => new Button(s, { x: xs[i], y: by, w: bw, h: 140, label: labels[i], fontSize: fs, color, onClick });
      const again = result.passed ? undefined : make(0, COLORS.yellow, () => ctx.go('run', { challengeId }));
      const board = make(result.passed ? 0 : 1, 0xbfe3ff, toBoard);
      const room = make(labels.length - 1, 0xa8e6a1, () => ctx.go('room', { from: 'center' }));
      const actions = again ? [again, board, room] : [board, room];
      objs.push(...actions);
      group = new FocusGroup({
        audio: ctx.audio, touch: ctx.input.touch,
        onEdge: (dir) => { if (dir === 'left') pager?.go(-1); else if (dir === 'right') pager?.go(1); },
      });
      if (pagesN > 1) {
        pager = new Pager(s, { x: w / 2, y: pagerY, pages: pagesN, onChange: (p) => { page = p; drawPage(); } });
        group.set([...pager.buttons, ...actions]);
      } else {
        group.set(actions);
      }
      group.focus(result.passed ? board : room);
    },
    update(dt: number) {
      age += dt;
      const actions = ctx.input.poll();
      if (age < INPUT_GUARD_MS) return;
      for (const a of actions) {
        if (a === 'back') toBoard();
        else group?.handle(a);
      }
    },
    destroy() {
      group?.destroy();
      group = undefined;
      pager?.destroy();
      pager = undefined;
      timers.forEach((t) => t.remove(false));
      timers.length = 0;
      const all = [...objs, ...pageObjs];
      all.forEach((o) => { try { ctx.scene.tweens.killTweensOf(o); } catch { /* scene shutting down */ } });
      all.forEach((o) => o.destroy());
      objs.length = 0;
      pageObjs.length = 0;
    },
  };
};

export default resultsScreen;
