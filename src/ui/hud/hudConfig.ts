import { CAMERA, GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import type { Rect } from '../../core/types';

/** HUD tunables (package I). */
export const HUD = {
  margin: 20,
  scoreboard: { w: 440, h: 250, top: 10, clearHalf: 220, timerX: -108, goalsX: 28 },
  timerWarnSec: 30,
  timerBar: { h: 26, bottomMargin: 26, flashSec: 1, gap: 14 },
  panel: {
    showSec: 0.6,          // large + shaking + glowing at the top
    shrinkSec: 0.3,        // then shrinks to the docked size
    shakePx: 16,
    dockFrac: 0.95,        // docked scale = big scale * this (capped at 1)
    resultHoldSec: 0.7,    // show correct/wrong before fading
    fadeSec: 0.35,
    timeoutFadeSec: 0.4,
    wrongHintDelaySec: 0.3,
    maxBigScale: 1.7,
    carGap: 60,            // px between the car's screen spot and the panel's top edge
    maxW: 920,             // widest the panel/timer get (single mode is centered, not stretched)
    tagH: 62,              // room for the 'Look!' tag, drawn over the gap above the panel
  },
  /** Question-break panel in split screen: sits below the center scoreboard instead of over it. */
  breakSplit: { maxViewW: 1200, gapBelowScoreboard: 14, bottomMargin: 20 },
  /** Small "Waiting…" pill (teammate wait) near the top of each view. */
  hint: { waitSec: 2.5, y: 112, textSize: 46 },
  popupSec: 1.4,
  /** 2x2 quadrant layout (3-4 players): views are 960x540, so per-view elements use these tighter values. */
  quad: { bannerSize: 100, alertSize: 84, centerClear: 240, maxViewH: 600, margin: 10, hintY: 56, popupMinY: 90, popupBottom: 100, bannerY: 250, bannerSeamGap: 160 },
  /** JBQ (Junior Bible Quiz) panel: long question + four full-width answer rows. Font sizes are in panel px (panel scale is ~1). */
  jbq: {
    pad: 14, dividerGap: 40, rowGap: 10, rowPadY: 12, rowPadX: 18, qPadY: 16, qSideInset: 56,
    badge: 64, quadBadge: 44,
    /** Tighter paddings for the 960x540 quadrant views (3-4 players). */
    quadPad: { pad: 10, dividerGap: 26, rowGap: 6, rowPadY: 6, rowPadX: 14, qPadY: 8 },
    maxW: 1700,               // widest the panel gets in a wide (1-player) view
    questionShare: 0.3,       // share of spare height the question card takes (rest goes to the answer rows)
    refScale: 1.25,           // verse reference size vs. verse text size
    font: { answerMax: 60, answerMin: 40, answerHard: 30, questionMax: 76, questionMin: 40, questionHard: 30 },
    fontQuad: { answerMax: 44, answerMin: 30, answerHard: 26, questionMax: 50, questionMin: 30, questionHard: 26 },
    growSec: 0.3,             // wrong-answer reveal: correct answer grows to fill the answer area
    revealPad: 22,
    revealFadeGraceSec: 0.3,  // keep the reveal this long past wrongRevealSec before fading (the next question normally replaces it first)
    revealMaxFont: 120,
  },
  /** Perf overlay corner (top-left of the screen). */
  perf: { x: 12, y: 12, size: 38, intervalSec: 1, rows: 6, rowsWithWorst: 3 },
  playerLight: ['#7dff8a', '#ff8a80', '#7fc3ff', '#ffd666'],
  colors: { navy: 0x14213d, card: 0xffffff, green: 0x2ecc40, gray: 0xaab2bd, red: 0xff3b30, gold: 0xffd43b },
} as const;

/** A view shorter than this is a quadrant (3-4 player layout). */
export const isQuadView = (view: Rect): boolean => view.h <= HUD.quad.maxViewH;

/** Centre scoreboard for 4 players, where the four quadrants meet. */
export function quadScoreboardRect(): Rect {
  const w = 460, h = 290;
  return { x: (GAME_WIDTH - w) / 2, y: (GAME_HEIGHT - h) / 2, w, h };
}

export function scoreboardRect(players: number): Rect {
  const { w, h, top } = HUD.scoreboard;
  return {
    x: players > 1 ? (GAME_WIDTH - w) / 2 : HUD.margin,
    y: top,
    w,
    h: players > 1 ? h : h - 56,
  };
}

/** Screen y of the car in a player's view (the camera keeps it at CAMERA.carScreenY). */
export function carScreenPos(view: Rect): { x: number; y: number } {
  return { x: view.x + view.w / 2, y: view.y + view.h * (isQuadView(view) ? CAMERA.quadCarScreenY : CAMERA.carScreenY) };
}

/** Free region under the car for the challenge panel (above the timer bar), centered on the car. */
export function challengeRegion(view: Rect): Rect {
  const car = carScreenPos(view);
  const w = Math.min(HUD.panel.maxW, view.w - 2 * HUD.margin);
  const top = car.y + HUD.panel.carGap;
  const bottom = view.y + view.h - HUD.timerBar.bottomMargin - HUD.timerBar.h - HUD.timerBar.gap;
  return { x: car.x - w / 2, y: top, w, h: Math.max(100, bottom - top) };
}

/** Region for the centered question-break panel: {y: top, h: height available}; null = use the default centered layout. */
export function breakSplitRegion(view: Rect): { top: number; h: number } {
  // Quadrant views have no scoreboard on top (it sits at the screen centre): use nearly the whole quadrant.
  if (isQuadView(view)) return { top: view.y + HUD.quad.margin, h: view.h - 2 * HUD.quad.margin };
  // Split views (narrow) sit under the tall 2-player scoreboard; a full-width view under the shorter 1-player one.
  const sb = scoreboardRect(view.w > HUD.breakSplit.maxViewW ? 1 : 2);
  const top = sb.y + sb.h + HUD.breakSplit.gapBelowScoreboard;
  const bottom = view.y + view.h - HUD.breakSplit.bottomMargin;
  return { top, h: bottom - top };
}

interface TextSpot { x: number; y: number }
export interface ScoreboardLayout {
  /** Screen rect; the container is placed at the top-centre of it, local y runs 0..h. */
  rect: Rect;
  label: TextSpot & { text: string; size: number; origin: [number, number] };
  team: TextSpot & { size: number; origin: [number, number] };
  timer: TextSpot & { size: number };
  goals: TextSpot & { dx: number; size: number };
  flagScale: number;
  pts: TextSpot[];
  ptsSize: number;
  /** Where "+1" should fly to, relative to the container origin. */
  fly: TextSpot;
}

/** Local layout (container at the rect's top-centre) of the scoreboard for 1, 2, or 3-4 players. */
export function scoreboardLayout(players: number): ScoreboardLayout {
  const base = { flagScale: 1, ptsSize: 48 };
  if (players >= 4) {
    const rect = quadScoreboardRect();
    return {
      ...base, rect,
      label: { x: -rect.w / 2 + 28, y: 56, text: 'TEAM', size: 46, origin: [0, 0.5] },
      team: { x: rect.w / 2 - 28, y: 56, size: 104, origin: [1, 0.5] },
      timer: { x: HUD.scoreboard.timerX - 8, y: 130, size: 56 },
      goals: { x: HUD.scoreboard.goalsX + 8, y: 130, dx: 26, size: 56 },
      pts: [{ x: -110, y: 196 }, { x: 110, y: 196 }, { x: -110, y: 252 }, { x: 110, y: 252 }],
      fly: { x: 60, y: 56 },
    };
  }
  if (players === 3) {
    // Team panel in the free bottom-right quadrant.
    const q = { x: GAME_WIDTH / 2 + 30, y: GAME_HEIGHT / 2 + 24, w: GAME_WIDTH / 2 - 60, h: GAME_HEIGHT / 2 - 48 };
    return {
      flagScale: 1.6, ptsSize: 64, rect: q,
      label: { x: 0, y: 46, text: 'TEAM SCORE', size: 54, origin: [0.5, 0.5] },
      team: { x: 0, y: 140, size: 160, origin: [0.5, 0.5] },
      timer: { x: -200, y: 276, size: 84 },
      goals: { x: 150, y: 276, dx: 44, size: 84 },
      pts: [{ x: -270, y: 384 }, { x: 0, y: 384 }, { x: 270, y: 384 }],
      fly: { x: 0, y: 150 },
    };
  }
  const two = players > 1;
  const rect = scoreboardRect(players);
  return {
    ...base, rect,
    label: { x: -rect.w / 2 + 28, y: 66, text: 'TEAM', size: 46, origin: [0, 0.5] },
    team: { x: rect.w / 2 - 28, y: 66, size: 104, origin: [1, 0.5] },
    timer: { x: HUD.scoreboard.timerX, y: two ? 208 : 152, size: 56 },
    goals: { x: HUD.scoreboard.goalsX, y: two ? 208 : 152, dx: 26, size: 56 },
    pts: two ? [{ x: -95, y: 138 }, { x: 95, y: 138 }] : [],
    fly: { x: 60, y: 66 },
  };
}
