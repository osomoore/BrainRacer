/**
 * board: the player's composed model and challenge board. Wide layout: model preview + challenge tabs and details.
 * Tall layout: the same single view (vehicle, challenge tabs, selected challenge text). "Test it!" starts a run: go('run', { challengeId }).
 */
import type Phaser from 'phaser';
import { WS_ROOM, WS_UI } from '../config';
import type { ModelRig, PaneContext, Screen, ScreenFactory } from '../core/runtime';
import type { Challenge, WorkshopProgress } from '../core/types';
import { ensureCurrencyIcon } from '../art/icons';
import { engine } from '../logic';
import { newAdminChallenges } from '../shell/adminMode';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { pageCount, pageItems } from '../ui/paging';
import { promptLabel } from '../ui/input';
import { cardColor } from '../ui/screenChrome';
import { COLORS, circleTexture, fitText, makeText, ringTexture, roundedOriginY, roundedTexture } from '../ui/style';
import { roomBackdrop } from './room/backdrop';
import { buildBlocks, planDetail, type Measure } from './board/cardText';
import { boardLayout, detailFonts, type BoardLayout, type BoxC } from './board/layout';
import { PartPreview } from './board/PartPreview';
import { chooseBoardFocus, restoreChallengeIndex, type BoardFocusKey } from './board/focusChoice';
import { challengeReward, rewardLabel, rewardTextWidth, stageTextWidth } from './board/reward';
import { guardBackAfterPreview, isBackGuarded } from './backGuard';
import { currentProgress } from './room/progress';
import { roomLayout } from './room/layout';

const STAGE_COLORS = [0xffd23f, 0x7fd6ff, 0xffa3b8, 0xb8e986, 0xd5b8ff];
/** Card footer pill (stage count + reward) height and inner margin from the card edge. */
const FOOTER_H = 54;
const CARD_PAD = 8;
/** Selection survives screen swaps and is scoped by pane, profile, workshop, and admin state. */
interface BoardReturn { challengeId?: string; selectedIndex: number; textPage: number; focus?: BoardFocusKey }
const boardReturn = new WeakMap<object, Map<string, BoardReturn>>();
let canvasCtx: CanvasRenderingContext2D | null | undefined;
const measure: Measure = (text, size) => {
  if (canvasCtx === undefined) canvasCtx = document.createElement('canvas').getContext('2d');
  if (!canvasCtx) return text.length * size * 0.6;
  canvasCtx.font = `bold ${size}px ${WS_UI.font}`;
  return canvasCtx.measureText(text).width;
};

const boardScreen: ScreenFactory = (): Screen => {
  let ctx: PaneContext;
  let L: BoardLayout;
  let group: FocusGroup;
  let rig: ModelRig | undefined;
  let progress: WorkshopProgress;
  let sel = 0;
  let cardPage = 0;
  let textPage = 0;
  let busy = false;
  let cardPager: Pager | undefined;
  let textPager: Pager | undefined;
  let cardBtns: Button[] = [];
  let lastFocus: Button | undefined;
  const staticObjs: Phaser.GameObjects.GameObject[] = [];
  let cardObjs: Phaser.GameObjects.GameObject[] = [];
  let detailObjs: Phaser.GameObjects.GameObject[] = [];
  let backBtn: Button;
  let newBtn: Button | undefined;
  let modelObjs: Phaser.GameObjects.GameObject[] = [];
  let testBtn: Button | undefined;
  let partPreview: PartPreview | undefined;
  /** Part selection: focus is on the vehicle; Up/Down (wide) or Left/Right (narrow) cycle, the opposite way leaves. */
  let partMode = false;
  let returnFocus: Button | undefined;
  let ring: Phaser.GameObjects.Image | undefined;
  let sessionReturnKey = '';

  const ws = () => ctx.workshop ?? 'race';
  const wide = () => ctx.layout === 'wide';
  const ids = () => progress.active;
  const challenge = (): Challenge | undefined => progress.challenges[ids()[sel]];
  const hook = (fn: () => void): Phaser.GameObjects.GameObject => ({ destroy: fn, scene: ctx.scene } as unknown as Phaser.GameObjects.GameObject);
  const kill = (list: Phaser.GameObjects.GameObject[]) => { list.forEach((o) => { if (o.scene) o.destroy(); }); list.length = 0; };

  const readProgress = () => {
    const save = ctx.save();
    const p = currentProgress(ctx, ws());
    if (!ctx.adminMode && JSON.stringify(save.workshops[ws()]) !== JSON.stringify(p)) ctx.commit({ ...save, workshops: { ...save.workshops, [ws()]: p } });
    progress = p;
  };

  // ------------------------------------------------------------ composed model
  const buildModel = () => {
    const scene = ctx.scene;
    const panel = wide() ? { x: 330, y: 470, w: 620, h: 890 } : (L.modelPanel as BoxC);
    modelObjs.push(scene.add.image(panel.x, panel.y, roundedTexture(scene, panel.w, panel.h, 0xfff8e6, { radius: 36 })).setOrigin(0.5, roundedOriginY(panel.h)).setDepth(-300));
    rig = ctx.buildRig(scene, ws(), progress.model, 'side');
    const s = Math.min(WS_ROOM.boardModelScale[ctx.layout], L.model.maxW / Math.max(1, rig.width), L.model.maxH / Math.max(1, rig.height));
    rig.root.setPosition(L.model.x, L.model.groundY).setScale(s).setDepth(-200);
    rig.play('idle');
    modelObjs.push(scene.add.ellipse(L.model.x, L.model.groundY + 6, Math.min(L.model.maxW, rig.width * s * 1.05), 26, 0x000000, 0.2).setDepth(-250));
  };

  const destroyPartPreview = () => {
    partPreview?.destroy(); partPreview = undefined;
  };

  const buildPartPreview = () => {
    destroyPartPreview();
    if (!rig) return;
    const cat = engine.catalog(ws());
    partPreview = new PartPreview(ctx.scene, rig, cat.aspects, {
      layout: L.partPreview, model: progress.model, variants: cat.variants,
      onTap: (kind) => { if (!partMode) enterPartMode(group.focused, false); if (kind === 'arrow') ctx.audio.sfx('select'); },
    });
  };

  // ------------------------------------------------------------ cards
  const buildCards = () => {
    kill(cardObjs);
    cardBtns = [];
    const scene = ctx.scene;
    const list = ids();
    const first = cardPage * L.perPage;
    pageItems(list, cardPage, L.perPage).forEach((id, k) => {
      const c = progress.challenges[id];
      const slot = L.cards[k];
      const gi = first + k;
      const b = new Button(scene, {
        x: slot.x, y: slot.y, w: slot.w, h: slot.h, color: cardColor(c.boardColor ?? gi),
        onClick: () => {
          ctx.audio.sfx('select');
          group.focus(b); lastFocus = b; select(gi);
        },
      });
      const stages = c.stages.length;
      const reward = challengeReward(c);
      if (L.compactCards) {
        const t = makeText(scene, -slot.w / 2 + 30, 0, c.title, { size: slot.h > 120 ? 56 : 48, align: 'left', origin: [0, 0.5] });
        fitText(t, slot.w - 330);
        b.add(t);
        addFooter(b, slot.h / 2 - 40, stages, reward);
      } else if (!wide()) { // narrow tab: the title, then the reward footer (stage count is in the detail below)
        const footerY = slot.h / 2 - CARD_PAD - FOOTER_H / 2;
        const titleBox = slot.h - 2 * CARD_PAD - FOOTER_H - CARD_PAD;
        const t = makeText(scene, 0, -slot.h / 2 + CARD_PAD + titleBox / 2, c.title, { size: 44, wrap: slot.w - 24 });
        for (let size = 40; t.height > titleBox && size >= 32; size -= 4) t.setFontSize(size);
        b.add(t);
        addFooter(b, footerY, 1, reward);
      } else {
        const t = makeText(scene, 0, stages > 1 ? -28 : 0, c.title, { size: 48, wrap: slot.w - 30 });
        if (t.height > 120) t.setFontSize(40);
        b.add(t);
        addFooter(b, slot.h / 2 - 40, stages, reward);
      }
      cardBtns.push(b);
      cardObjs.push(b);
    });
    const pages = pageCount(list.length, L.perPage);
    if (pages > 1) {
      cardPager = new Pager(scene, { x: L.pager.x, y: L.pager.y, gap: L.pager.gap, pages, page: cardPage, onChange: (p) => { cardPage = p; sel = Math.min(p * L.perPage, list.length - 1); refreshAll(); } });
      cardObjs.push(hook(() => { cardPager?.destroy(); cardPager = undefined; }));
    }
    ring = scene.add.image(0, 0, ringTexture(scene, L.cards[0].w + 24, L.cards[0].h + 24, COLORS.blue, 14)).setDepth(-1);
    cardObjs.push(ring);
    placeRing();
  };

  function placeRing(): void {
    if (!ring) return;
    const idx = sel - cardPage * L.perPage;
    if (idx >= 0 && idx < cardBtns.length) ring.setPosition(L.cards[idx].x, L.cards[idx].y).setVisible(true); else ring.setVisible(false);
  }

  /** Card footer: one white pill centred on (0, y) with the stage count (when several stages) and the reward coins. */
  function addFooter(b: Button, y: number, stages: number, reward: number): void {
    const scene = ctx.scene;
    const pad = 20, gap = 24, icon = 48, iconGap = 6;
    const showStages = stages > 1;
    const stageText = `${stages} stages`;
    const stageW = showStages ? stageTextWidth(stageText, measure) : 0;
    const rewardW = icon + iconGap + rewardTextWidth(reward, measure);
    const w = pad * 2 + stageW + (showStages ? gap : 0) + rewardW;
    const h = FOOTER_H;
    const objs: Phaser.GameObjects.GameObject[] = [
      scene.add.image(0, y, roundedTexture(scene, w, h, 0xffffff, { radius: 27, shadow: 0, strokeW: 4, gloss: false })).setOrigin(0.5, roundedOriginY(h, 0)),
    ];
    let x = -w / 2 + pad;
    if (showStages) {
      objs.push(makeText(scene, x, y, stageText, { size: 40, color: COLORS.ink, align: 'left', origin: [0, 0.5] }));
      x += stageW + gap;
    }
    objs.push(scene.add.image(x + icon / 2, y, ensureCurrencyIcon(scene, ws())).setDisplaySize(icon, icon));
    objs.push(makeText(scene, x + icon + iconGap, y, rewardLabel(reward), { size: 40, color: COLORS.ink, align: 'left', origin: [0, 0.5] }));
    b.add(objs);
  }

  // ------------------------------------------------------------ detail
  const buildDetail = () => {
    kill(detailObjs);
    textPager = undefined;
    testBtn = undefined;
    const scene = ctx.scene;
    const c = challenge();
    if (!c) return;
    const P = L.panel;
    detailObjs.push(scene.add.image(P.x, P.y, roundedTexture(scene, P.w, P.h, 0xffffff, { radius: 36 })).setOrigin(0.5, roundedOriginY(P.h)).setDepth(-300));
    if (!wide()) { // The selected card already shows the title in the wide layout.
      const title = makeText(scene, L.title.x, L.title.y, c.title, { size: L.title.size, align: 'left', origin: [0, 0.5], color: COLORS.ink });
      fitText(title, L.title.maxW);
      detailObjs.push(title);
    }

    const T = L.textArea;
    const multi = c.stages.length > 1;
    const indent = 96;
    const plan = planDetail(buildBlocks(c, ctx.reading()), {
      maxW: T.w, indent, boxH: T.h, sizes: detailFonts(ctx.layout), lineGap: WS_ROOM.detailLineGap, blockGap: 22, measure,
    });
    textPage = Math.min(textPage, plan.pages.length - 1);
    for (const pb of plan.pages[textPage] ?? []) {
      const isReq = pb.block.kind === 'req';
      const tx = T.x + (isReq ? indent : 0);
      const t = makeText(scene, tx, T.y + pb.y, pb.lines.join('\n'), { size: plan.size, align: 'left', origin: [0, 0], bold: isReq, color: isReq ? COLORS.ink : 0x4a4a6a });
      t.setLineSpacing(Math.round(plan.size * 0.1));
      detailObjs.push(t);
      if (isReq) {
        const d = 64;
        const cy = T.y + pb.y + Math.min(plan.size * 0.7, 34);
        detailObjs.push(scene.add.image(T.x + d / 2, cy, circleTexture(scene, d, STAGE_COLORS[pb.block.stage % STAGE_COLORS.length])));
        detailObjs.push(makeText(scene, T.x + d / 2, cy, multi ? String(pb.block.stage + 1) : '★', { size: 44, color: COLORS.ink }));
      }
    }
    if (plan.pages.length > 1) {
      textPager = new Pager(scene, { x: L.textPager.x, y: L.textPager.y, gap: L.textPager.gap, pages: plan.pages.length, page: textPage, onChange: (p) => { textPage = p; buildDetail(); setFocusables(); } });
      detailObjs.push(hook(() => { textPager?.destroy(); textPager = undefined; }));
    }

    const test = new Button(scene, {
      x: L.testBtn.x, y: L.testBtn.y, w: L.testBtn.w, h: L.testBtn.h, label: 'Test it!', fontSize: 64, color: COLORS.green, textColor: COLORS.paper,
      badge: promptLabel(ctx.input, 'confirm'), onClick: () => startRun(c.id, 'test'),
    });
    detailObjs.push(test);
    testBtn = test;
  };

  function focusKey(button: Button | undefined): BoardFocusKey | undefined {
    if (!button) return undefined;
    const card = cardBtns.indexOf(button);
    if (card >= 0) return `card:${ids()[cardPage * L.perPage + card]}`;
    if (cardPager?.prev === button) return 'cardPrev';
    if (cardPager?.next === button) return 'cardNext';
    if (textPager?.prev === button) return 'textPrev';
    if (textPager?.next === button) return 'textNext';
    if (newBtn === button) return 'newChallenges';
    if (testBtn === button) return 'test';
    if (backBtn === button) return 'back';
    return undefined;
  }

  function saveReturn(challengeId?: string, focus = focusKey(partMode ? returnFocus : group.focused)): void {
    const selectedId = challenge()?.id;
    challengeId ??= focus?.startsWith('card:') ? focus.slice(5) : selectedId;
    const records = boardReturn.get(ctx) ?? new Map<string, BoardReturn>();
    records.set(sessionReturnKey, {
      challengeId, selectedIndex: restoreChallengeIndex(ids(), challengeId, sel),
      textPage: challengeId === selectedId ? textPage : 0, focus,
    });
    boardReturn.set(ctx, records);
  }

  function startRun(id: string, focus: BoardFocusKey): void {
    if (busy) return;
    saveReturn(id, focus);
    busy = true;
    ctx.audio.sfx('select');
    ctx.go('run', { challengeId: id });
  }

  // ------------------------------------------------------------ focus / modes
  function setFocusables(restore?: BoardReturn): void {
    const list: Button[] = [...cardBtns];
    if (cardPager) list.push(...cardPager.buttons);
    if (newBtn) list.push(newBtn);
    if (textPager) list.push(...textPager.buttons);
    if (testBtn) list.push(testBtn);
    list.push(backBtn);
    group.set(list);
    const selectedCard = cardBtns[sel - cardPage * L.perPage];
    let target: Button | undefined = lastFocus && list.includes(lastFocus) ? lastFocus : selectedCard;
    if (restore) {
      const available = new Map<BoardFocusKey, Button>();
      for (const button of list) {
        const key = focusKey(button);
        if (key && button.isEnabled) available.set(key, button);
      }
      const key = chooseBoardFocus(restore.focus, [...available.keys()], focusKey(selectedCard));
      if (key) target = available.get(key);
    }
    group.focus(target ?? list[0]);
    lastFocus = group.focused;
  }

  function select(i: number): void {
    if (i === sel) return;
    sel = i;
    textPage = 0;
    placeRing();
    buildDetail();
    setFocusables();
  }

  function refreshAll(restore?: BoardReturn): void {
    buildCards();
    buildDetail();
    setFocusables(restore);
  }

  function enterPartMode(from: Button | undefined, first = true): void {
    partMode = true;
    returnFocus = from;
    group.focus(undefined);
    if (first) partPreview?.showFirst();
    ctx.audio.sfx('select');
  }

  function leavePartMode(fromBack = false): void {
    partMode = false;
    partPreview?.clear();
    group.focus(returnFocus ?? cardBtns[0]);
    lastFocus = group.focused;
    if (fromBack) guardBackAfterPreview(ctx, ctx.scene.time.now);
    ctx.audio.sfx('back');
  }

  const handleBack = () => {
    if (isBackGuarded(ctx, ctx.scene.time.now)) return;
    if (partMode) leavePartMode(true);
    else leave();
  };

  const leave = () => {
    if (busy) return;
    saveReturn();
    busy = true;
    ctx.audio.sfx('back');
    ctx.go('room', { from: 'center' });
  };

  const rebuildAdmin = () => {
    if (!newAdminChallenges(ctx)) return;
    ctx.audio.sfx('sparkle');
    sel = 0; cardPage = 0; textPage = 0;
    progress = currentProgress(ctx, ws());
    lastFocus = undefined;
    refreshAll();
  };

  return {
    create(c) {
      ctx = c;
      sessionReturnKey = `${ws()}|${ctx.profileId ?? ''}|${ctx.adminMode ? 'admin' : 'player'}`;
      const scene = ctx.scene;
      ctx.audio.music(ws() === 'race' ? 'raceShop' : 'dinoLab');
      readProgress();
      L = boardLayout(ctx.layout, ctx.adminMode);
      const records = boardReturn.get(ctx);
      const restore = records?.get(sessionReturnKey);
      records?.delete(sessionReturnKey);
      if (restore) {
        sel = restoreChallengeIndex(ids(), restore.challengeId, restore.selectedIndex);
        cardPage = Math.floor(sel / L.perPage);
        textPage = ids()[sel] === restore.challengeId ? restore.textPage : 0;
      }
      const RL = roomLayout(ctx.layout, []);
      const bg = roomBackdrop(scene, ws(), ctx.layout, RL.floorY);
      staticObjs.push(scene.add.image(0, 0, bg.key).setOrigin(0).setDepth(-900));
      staticObjs.push(scene.add.rectangle(0, 0, L.size.w, L.size.h, 0xffffff, 0.45).setOrigin(0).setDepth(-850));
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      backBtn = new Button(scene, { x: L.back.x, y: L.back.y, w: L.back.w, h: L.back.h, label: 'Back', fontSize: 52, color: 0xffb3b3, badge: promptLabel(ctx.input, 'back'), onClick: handleBack });
      staticObjs.push(backBtn);
      if (ctx.adminMode) {
        newBtn = new Button(scene, { x: L.newBtn.x, y: L.newBtn.y, w: L.newBtn.w, h: L.newBtn.h, label: 'New Challenges', fontSize: 48, color: COLORS.blue, textColor: COLORS.paper, onClick: () => rebuildAdmin() });
        staticObjs.push(newBtn);
      }
      buildModel();
      buildPartPreview();
      refreshAll(restore);
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (busy) continue;
        const f = group.focused;
        if (partMode) {
          const prev = wide() ? 'up' : 'left', next = wide() ? 'down' : 'right', out = wide() ? 'right' : 'down';
          if (a === prev || a === next) { partPreview?.step(a === next ? 1 : -1); ctx.audio.sfx('select'); }
          else if (a === out) leavePartMode();
          else if (a === 'back') handleBack();
          continue;
        }
        if (partPreview && ((wide() && a === 'left' && (f === cardBtns[0] || f === testBtn)) || (!wide() && a === 'up' && f && cardBtns.includes(f)))) {
          enterPartMode(f);
          continue;
        }
        if (a === 'back') { handleBack(); continue; }
        if (a === 'confirm' && f && cardBtns.includes(f)) {
          const id = ids()[cardPage * L.perPage + cardBtns.indexOf(f)];
          startRun(id, `card:${id}`);
          continue;
        }
        group.handle(a);
      }
      const f = group.focused;
      if (f !== lastFocus) {
        lastFocus = f;
        const k = f ? cardBtns.indexOf(f) : -1;
        if (k >= 0) select(cardPage * L.perPage + k);
      }
    },
    destroy() {
      if (!busy && group) saveReturn();
      group?.destroy();
      cardPager?.destroy(); textPager?.destroy();
      cardPager = undefined; textPager = undefined;
      destroyPartPreview();
      rig?.destroy(); rig = undefined;
      for (const list of [cardObjs, detailObjs, modelObjs, staticObjs]) kill(list);
      cardBtns = [];
    },
  };
};

export default boardScreen;
