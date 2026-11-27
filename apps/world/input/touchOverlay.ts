import Phaser from 'phaser';
import { TOUCH } from '../config';
import { TouchState, type ButtonId } from './touchMapping';

const COLORS: Record<ButtonId, number> = { a: 0x2fbf5a, b: 0xe5484d, x: 0x2f7de1, y: 0xf5b81c };
const LETTERS: Record<ButtonId, string> = { a: 'A', b: 'B', x: 'X', y: 'Y' };
const PAD = 10;

/** Bake the overlay textures once per game (shapes are drawn into textures, never into a live Graphics). */
function bake(scene: Phaser.Scene): void {
  if (scene.textures.exists('touch:base')) return;
  const make = (key: string, size: number, draw: (g: Phaser.GameObjects.Graphics, c: number) => void) => {
    const g = scene.add.graphics().setVisible(false);
    draw(g, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  };
  const R = TOUCH.stickRadius;
  make('touch:base', (R + PAD) * 2, (g, c) => {
    g.fillStyle(0x000000, 0.35).fillCircle(c, c, R);
    g.lineStyle(10, 0xffffff, 1).strokeCircle(c, c, R - 5);
    g.lineStyle(4, 0x000000, 0.6).strokeCircle(c, c, R + 2);
  });
  const K = TOUCH.knobRadius;
  make('touch:knob', (K + PAD) * 2, (g, c) => {
    g.fillStyle(0xffffff, 1).fillCircle(c, c, K);
    g.lineStyle(8, 0x1c2540, 1).strokeCircle(c, c, K - 4);
    g.fillStyle(0xcfd8ff, 1).fillCircle(c, c, K * 0.55);
  });
  const B = TOUCH.buttonRadius;
  for (const id of Object.keys(COLORS) as ButtonId[]) {
    make(`touch:btn:${id}`, (B + PAD) * 2, (g, c) => {
      g.fillStyle(0x000000, 0.45).fillCircle(c, c + 6, B);
      g.fillStyle(COLORS[id], 1).fillCircle(c, c, B);
      g.lineStyle(8, 0xffffff, 1).strokeCircle(c, c, B - 4);
    });
  }
}

export interface TouchOverlay {
  update(): void;
  /** True once any pointer went down on the overlay since the last call. */
  consumeTouched(): boolean;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/** Fixed-to-screen stick + A/B/X/Y buttons drawn in `scene`, fed by the scene's pointers (multi-touch). */
export function createTouchOverlay(scene: Phaser.Scene, state: TouchState): TouchOverlay {
  bake(scene);
  scene.input.addPointer(TOUCH.extraPointers);
  const D = TOUCH.depth;
  const home = { x: TOUCH.stickRadius + TOUCH.stickMargin + 70, y: 800 };
  const base = scene.add.image(home.x, home.y, 'touch:base').setDepth(D).setAlpha(0.28);
  const knob = scene.add.image(home.x, home.y, 'touch:knob').setDepth(D + 1).setAlpha(0.28);
  const buttons = state.buttons.map(spec => {
    const img = scene.add.image(spec.x, spec.y, `touch:btn:${spec.id}`).setDepth(D).setAlpha(TOUCH.idleAlpha);
    const text = scene.add.text(spec.x, spec.y - 2, LETTERS[spec.id], {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '76px', color: '#ffffff', stroke: '#1c2540', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(D + 1).setAlpha(TOUCH.idleAlpha);
    return { spec, img, text };
  });
  let touched = false;

  const onDown = (p: Phaser.Input.Pointer) => { touched = true; state.down(p.id, p.x, p.y); };
  const onMove = (p: Phaser.Input.Pointer) => state.move(p.id, p.x, p.y);
  const onUp = (p: Phaser.Input.Pointer) => state.up(p.id);
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  const onBlur = () => state.cancelAll();
  window.addEventListener('blur', onBlur);

  let visible = true;
  const all = () => [base, knob, ...buttons.flatMap(b => [b.img, b.text])];

  return {
    update() {
      if (!visible) return;
      const active = state.stickPointer !== null;
      const ox = active ? state.base.x : home.x;
      const oy = active ? state.base.y : home.y;
      const a = active ? TOUCH.activeAlpha : 0.28;
      base.setPosition(ox, oy).setAlpha(a);
      knob.setPosition(ox + state.knob.x, oy + state.knob.y).setAlpha(a);
      for (const b of buttons) {
        const held = state.held[b.spec.id];
        const alpha = held ? TOUCH.activeAlpha : TOUCH.idleAlpha;
        const scale = held ? 0.9 : 1;
        b.img.setAlpha(alpha).setScale(scale);
        b.text.setAlpha(alpha).setScale(scale);
      }
    },
    consumeTouched() { const t = touched; touched = false; return t; },
    setVisible(v) {
      visible = v;
      for (const o of all()) o.setVisible(v);
      if (!v) state.cancelAll();
    },
    destroy() {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
      window.removeEventListener('blur', onBlur);
      for (const o of all()) o.destroy();
    },
  };
}
