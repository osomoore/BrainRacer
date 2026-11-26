/**
 * results: every requirement of the challenge at the player's reading level with a green check or red X,
 * grouped by stage (stage number badges when there is more than one stage; stages the run never reached are dimmed
 * but still marked), a currency payout and reasons after a win, a message for clever wins, up to two lines after a
 * failure that name a part that would have helped (logic/failHints), and buttons to retry, visit the board, or return to the workshop.
 *
 * Long checklists shrink the font (never below 40 px), then are paged (the payout and message stay on every page).
 * Input is ignored for a moment after the screen opens so a held A from the run does not press a button.
 */
import type Phaser from 'phaser';
import type { PaneContext, Screen, ScreenData, ScreenFactory } from '../core/runtime';
import type { Challenge, Requirement, RunResult } from '../core/types';
import { WS_AUDIO, WS_RESULTS, WS_UI, WS_WALLET } from '../config';
import { playWorkshopSfx } from '../audio';
import { currencyBadge } from '../ui/CurrencyBadge';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { addBackdrop, addHeader } from '../ui/screenChrome';
import { circleTexture, COLORS, fitText, makeText } from '../ui/style';
import { currentProgress } from './room/progress';
import { fitResults } from './results/layout';
import { getOutcome } from './run/outcome';
import { CATALOGS } from '../content';
import { cleverWinMessage } from '../logic/text';
import { visibleAspectIds } from '../logic/aspects';
import { successReasons } from '../logic/successReasons';
import { challengeTitle, readingText, STARTER_RESULTS } from '../logic/wording';

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
      if (ws) ctx.audio.music(WS_AUDIO.sceneMusic[ws]);
      const progress = ws ? currentProgress(ctx, ws) : undefined;
      const challenge: Challenge | undefined = progress?.challenges[challengeId];
      if (!ws || !progress || !result || !challenge) { toBoard(); return; }
      const reading = ctx.reading();
      const starter = reading === 'starter';
      const outcome = getOutcome(ctx.index);
      const displayTitle = starter
        ? outcome.testTitle ?? ''
        : challengeTitle(challenge, reading);
      const { w, h } = ctx.size;
      const wide = ctx.layout === 'wide';
      const s = ctx.scene;
      const min = WS_UI.minFont;

      keep(addBackdrop(ctx));
      ctx.audio.sting(result.passed ? 'success' : 'fail');
      const titleText = starter ? STARTER_RESULTS[result.passed ? 'win' : 'fail'] : result.passed ? 'It worked!' : 'Not yet!';
      const header = keep(addHeader(ctx, titleText, wide ? 78 : 66, wide ? 100 : 64));
      if (!wide) {
        // Leave room for the wallet at the top centre of a narrow pane.
        const right = w - 40;
        fitText(header, right - WS_WALLET.tall.x - 112);
        header.setX(right - header.width / 2);
      }
      const title = keep(makeText(s, w / 2, wide ? 184 : 152, displayTitle,
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
      const rowText = (row: Pick<Row, 'req'>) => readingText(row.req.text, reading);
      // One row per distinct sentence (Starter lines can repeat): it passes only when every requirement it stands for did.
      const rows: Row[] = [];
      const byText = new Map<string, Row>();
      challenge.stages.forEach((st, si) => st.requirements.forEach((req) => {
        const r = byId.get(req.id);
        const ok = !!r?.passed, reached = r ? r.reached : true;
        const key = rowText({ req }).trim().toLowerCase();
        const same = byText.get(key);
        if (same) { same.ok &&= ok; same.reached ||= reached; return; }
        const row: Row = { req, stage: si, first: !rows.some((x) => x.stage === si), ok, reached };
        byText.set(key, row);
        rows.push(row);
      }));
      const rowGap = 22;
      const stageGap = 20;
      const rowExtra = (row: Row, i: number) => rowGap + (multi && row.first && i > 0 ? stageGap : 0);
      const measureRows = (font: number): number[] => rows.map((row, i) => {
        const t = makeText(s, 0, 0, rowText(row), { size: font, wrap: textW, origin: [0, 0], bold: false, align: 'left' });
        const hh = Math.max(t.height, font + 16);
        t.destroy();
        return hh + rowExtra(row, i);
      });

      const catalog = CATALOGS[ws];
      const reasons = successReasons(catalog, challenge, result, reading, new Set(visibleAspectIds(catalog, progress)));
      const message = result.cleverWin ? cleverWinMessage(catalog, reading, challenge.seed)
        : !result.passed && outcome.hint ? (starter ? outcome.hint : `Hint: ${outcome.hint}`) : '';
      const lines = [...reasons, ...outcome.failLines, ...(message ? [message] : [])];
      const messageTexts = lines.map((line, i) => keep(makeText(s, w / 2, 0, line, {
        size: min, color: COLORS.ink, wrap: w - 112, origin: [0.5, 0], bold: i >= reasons.length,
      })).setDepth(1));
      const messagePadding = 15;
      const lineGap = 8;
      const messageHeight = lines.length
        ? messageTexts.reduce((sum, line) => sum + line.height, 2 * messagePadding + lineGap * (lines.length - 1)) : 0;

      const plan = fitResults({
        fonts,
        measure: (font) => ({ rows: measureRows(font), extras: messageHeight }),
        fullHeight: fullBottom - top,
        pagedHeight: pagedBottom - top,
        gap,
      });
      const font = plan.font;
      const pagesN = plan.pages.length;
      const rowHeights = measureRows(font);
      if (messageHeight) {
        const rowsBottom = top + rowHeights.reduce((sum, height) => sum + height, 0);
        const y = pagesN > 1 ? pagedBottom - messageHeight : Math.min(fullBottom - messageHeight, rowsBottom + gap);
        const messageWidth = Math.max(...messageTexts.map((line) => line.width)) + 60;
        keep(s.add.rectangle(w / 2, y + messageHeight / 2, Math.min(w - 40, messageWidth), messageHeight, COLORS.yellow)
          .setStrokeStyle(6, COLORS.ink));
        let lineY = y + messagePadding;
        for (const line of messageTexts) {
          line.setY(lineY);
          lineY += line.height + lineGap;
        }
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
          const line = makeText(s, textX, y + 6, rowText(row), { size: font, color: row.reached ? COLORS.ink : WS_RESULTS.unreachedText, wrap: textW, origin: [0, 0], bold: false, align: 'left' });
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
      const roomLabel = ws === 'race' ? STARTER_RESULTS.shop : STARTER_RESULTS.lab;
      const labels = starter
        ? (result.passed ? [STARTER_RESULTS.board, roomLabel] : [STARTER_RESULTS.retry, STARTER_RESULTS.board, roomLabel])
        : result.passed ? ['New Tests', 'Workshop'] : ['Run again', 'Pick a Test', 'Workshop'];
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
