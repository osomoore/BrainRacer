/**
 * Common screen furniture for pane screens (pane-local coordinates).
 *
 *   addBackdrop(ctx)            sky + hills image behind everything (the pane already has one; use for dev scenes)
 *   addHeader(ctx, 'Title', y)  big white headline with a dark outline, wraps to the pane width
 *   addBackButton(ctx, fn, x, y) "Back" button (>= 120 px high) with the pad / key badge for 'back'; returns Button
 *   cardColor(i)                friendly pastel color for the i-th card
 */
import type Phaser from 'phaser';
import type { PaneContext } from '../core/runtime';
import { WS_UI } from '../config';
import { Button } from './Button';
import { COLORS, backdropTexture, makeText } from './style';
import { promptLabel } from './input';

export function addBackdrop(ctx: PaneContext): Phaser.GameObjects.Image {
  return ctx.scene.add.image(0, 0, backdropTexture(ctx.scene, ctx.size.w, ctx.size.h)).setOrigin(0).setDepth(-1000);
}

export function addHeader(ctx: PaneContext, text: string, y = 100, size?: number): Phaser.GameObjects.Text {
  const s = size ?? (ctx.layout === 'wide' ? 84 : 64);
  return makeText(ctx.scene, ctx.size.w / 2, y, text, { size: s, color: COLORS.paper, stroke: COLORS.ink, wrap: ctx.size.w - 80 });
}

export function addBackButton(ctx: PaneContext, onClick: () => void, x = 175, y = ctx.size.h - 90, label = 'Back'): Button {
  return new Button(ctx.scene, { x, y, w: 220, h: WS_UI.tapMin, label, fontSize: 48, color: 0xffb3b3, badge: promptLabel(ctx.input, 'back'), onClick });
}

/** Shared touch-only corner control for leaving the active shop/board. */
export function addTouchBackButton(scene: Phaser.Scene, onClick: () => void): Button {
  return new Button(scene, { x: 145, y: 72, w: 230, h: 120, label: 'Back', fontSize: 48, color: 0xffb3b3, onClick }).setDepth(20);
}

const PASTELS = [0xffe08a, 0xa8e6a1, 0x9bd7ff, 0xffb3c7, 0xd5b8ff, 0xffc58a];
export function cardColor(i: number): number { return PASTELS[i % PASTELS.length]; }
