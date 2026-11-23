/**
 * results: every requirement of the challenge at the player's reading level with a green check or red X,
 * grouped by stage (stage number badges when there is more than one stage; stages the run never reached are dimmed
 * but still marked), a new-part line (with a small picture of the model wearing it) after a first win, the hint after
 * enough failed attempts, and Try again / Challenges / Workshop buttons.
 *
 * Long checklists shrink the font (never below 40 px), then are paged (the new part and the hint stay on every page).
 * Input is ignored for a moment after the screen opens so a held A from the run does not press a button.
 */
import type Phaser from 'phaser';
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { ModelRig } from '../core/runtime';
import type { Challenge, Model, Requirement, RunResult, WorkshopId } from '../core/types';
import { WS_RESULTS, WS_UI } from '../config';
import { engine } from '../logic';
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
  let rig: ModelRig | undefined;

  const toBoard = () => ctx.go('board');
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };

  interface Row { req: Requirement; stage: number; first: boolean; ok: boolean; reached: boolean }

  /** Small picture of the model wearing the new part(s), or undefined when the art is not available. */
  const newPartRig = (ws: WorkshopId, model: Model, unlocked: readonly string[], cx: number, bottom: number, maxW: number, maxH: number): ModelRig | undefined => {
    try {
      const cat = engine.catalog(ws);
      const m: Model = { ...model };
      for (const id of unlocked) { const v = cat.variants.find((x) => x.id === id); if (v) m[v.aspect] = v.id; }
      const r = ctx.buildRig(ctx.scene, ws, m, 'side');
      const k = Math.min(maxW / Math.max(1, r.width), maxH / Math.max(1, r.height), 1.4);
      r.root.setScale(k).setPosition(cx, bottom).setDepth(2);
      try { r.play('celebrate'); } catch { /* optional */ }
      return r;
    } catch (e) {
      console.warn('results: new-part picture failed', e);
      return undefined;
    }
  };

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
      keep(makeText(s, w / 2, wide ? 184 : 152, challenge.title, { size: wide ? 56 : 48, color: COLORS.paper, stroke: COLORS.ink, wrap: w - 80 }));

      // ---- geometry
      const top = wide ? 250 : 250;
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

      // ---- extras: new part + hint (built per font to measure, kept for the chosen font)
      const unlocked = outcome.unlocked;
      const showHint = !result.passed && !!outcome.hint;
      const partNames = unlocked.map((id) => engine.catalog(ws).variants.find((v) => v.id === id)?.name ?? id).join(', ');
      const picCell = wide ? 210 : 140;
      interface Extras { height: number; place(bottom: number): void; objs: Phaser.GameObjects.GameObject[]; tween?: Phaser.GameObjects.Text }
      const buildExtras = (font: number, live: boolean): Extras => {
        const made: Phaser.GameObjects.GameObject[] = [];
        let partRow = 0, hintH = 0;
        let partText: Phaser.GameObjects.Text | undefined;
        let hintText: Phaser.GameObjects.Text | undefined;
        let hintBg: Phaser.GameObjects.Rectangle | undefined;
        if (unlocked.length) {
          const textLeft = (wide ? 120 : 30) + picCell + 20;
          partText = makeText(s, textLeft, 0, `New part: ${partNames}!`, { size: font + 4, color: COLORS.yellow, stroke: COLORS.ink, strokeW: 10, wrap: w - textLeft - 30, origin: [0, 0.5], align: 'left' });
          partRow = Math.max(partText.height, picCell) + 6;
          made.push(partText);
        }
        if (showHint) {
          hintText = makeText(s, w / 2, 0, `Hint: ${outcome.hint}`, { size: font, color: COLORS.ink, wrap: w - 150, origin: [0.5, 0] });
          hintH = hintText.height + 30;
          hintBg = s.add.rectangle(w / 2, 0, Math.min(w - 40, hintText.width + 60), hintH, COLORS.yellow).setStrokeStyle(6, COLORS.ink);
          hintText.setDepth(1);
          made.push(hintBg, hintText);
        }
        const height = partRow + (partRow && hintH ? gap : 0) + hintH;
        const ex: Extras = {
          height, objs: made, tween: partText,
          place(bottom: number) {
            let y = bottom - height;
            if (partText) {
              const cy = y + partRow / 2;
              partText.setY(cy);
              if (live) {
                const cx = (wide ? 120 : 30) + picCell / 2;
                rig = newPartRig(ws, progress.model, unlocked, cx, cy + picCell / 2 - 8, picCell, picCell - 16);
              }
              y += partRow + gap;
            }
            if (hintText && hintBg) { hintBg.setY(y + hintH / 2); hintText.setY(y + 15); }
          },
        };
        return ex;
      };

      const plan = fitResults({
        fonts,
        measure: (font) => {
          const ex = buildExtras(font, false);
          ex.objs.forEach((o) => o.destroy());
          return { rows: measureRows(font), extras: ex.height };
        },
        fullHeight: fullBottom - top,
        pagedHeight: pagedBottom - top,
        gap,
      });
      const font = plan.font;
      const extras = buildExtras(font, true);
      extras.objs.forEach((o) => objs.push(o));
      const pagesN = plan.pages.length;
      const rowHeights = measureRows(font);
      // One page: the extras follow the checklist; paged: they sit at the bottom of every page.
      const flowBottom = top + rowHeights.reduce((a, b) => a + b, 0) + gap + extras.height + 14;
      extras.place(pagesN > 1 ? pagedBottom : Math.min(fullBottom, flowBottom));
      if (extras.tween) {
        const t = extras.tween;
        // pulse the text in place (scale about its left edge)
        s.tweens.add({ targets: t, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        timers.push(s.time.delayedCall(1200, () => ctx.audio.sting('unlock')));
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
      const again = new Button(s, { x: w / 2 - gapX, y: by, w: bw, h: 140, label: 'Try again', fontSize: fs, color: COLORS.yellow, onClick: () => ctx.go('run', { challengeId }) });
      const board = new Button(s, { x: w / 2, y: by, w: bw, h: 140, label: 'Challenges', fontSize: fs, color: 0xbfe3ff, onClick: toBoard });
      const room = new Button(s, { x: w / 2 + gapX, y: by, w: bw, h: 140, label: 'Workshop', fontSize: fs, color: 0xa8e6a1, onClick: () => ctx.go('room', { from: 'center' }) });
      objs.push(again, board, room);
      group = new FocusGroup({
        audio: ctx.audio, touch: ctx.input.touch,
        onEdge: (dir) => { if (dir === 'left') pager?.go(-1); else if (dir === 'right') pager?.go(1); },
      });
      if (pagesN > 1) {
        pager = new Pager(s, { x: w / 2, y: pagerY, pages: pagesN, onChange: (p) => { page = p; drawPage(); } });
        group.set([...pager.buttons, again, board, room]);
      } else {
        group.set([again, board, room]);
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
      try { rig?.destroy(); } catch { /* already gone */ }
      rig = undefined;
      const all = [...objs, ...pageObjs];
      all.forEach((o) => { try { ctx.scene.tweens.killTweensOf(o); } catch { /* scene shutting down */ } });
      all.forEach((o) => o.destroy());
      objs.length = 0;
      pageObjs.length = 0;
    },
  };
};

export default resultsScreen;
