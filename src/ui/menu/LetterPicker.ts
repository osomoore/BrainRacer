import Phaser from 'phaser';
import { services } from '../../core/services';
import { appendChar, buildKeys, deleteLast, isValidName, moveCursor, type PickerKey } from './letterGrid';
import { bigText, FONT_HEAD, MENU } from './style';

export interface LetterPickerOpts {
  title?: string;
  initial?: string;
  maxLen?: number;
  /** Accept physical-keyboard typing (default true). Turn off when the same keyboard is also the nav device (WASD would type letters). */
  keyboardTyping?: boolean;
  color: number;
}
export type PickerResult = 'none' | 'done' | 'cancel';

const KEY = 112, GAP = 16, PITCH = KEY + GAP, BOX_H = 120, COLS = 7;
const GRID_W = COLS * PITCH - GAP;

/**
 * On-screen name entry for gamepad/keyboard. The owning scene calls handle() each frame with the player's nav edges.
 * (x, y) is the top-center of the component. Height is about 850 with a title, 750 without.
 */
export class LetterPicker extends Phaser.GameObjects.Container {
  value: string;
  private readonly maxLen: number;
  private color: number;
  private rows = buildKeys(COLS);
  private pos = { row: 0, idx: 0 };
  private textObj: Phaser.GameObjects.Text;
  private cursor: Phaser.GameObjects.Rectangle;
  private hi: Phaser.GameObjects.Rectangle;
  private box: Phaser.GameObjects.Container;
  private keyBoxes = new Map<PickerKey, { x: number; y: number; w: number }>();
  private onKeyDown = (e: KeyboardEvent) => this.typed(e);
  private pending: PickerResult = 'none';

  constructor(scene: Phaser.Scene, x: number, y: number, opts: LetterPickerOpts) {
    super(scene, x, y);
    this.color = opts.color;
    this.maxLen = opts.maxLen ?? 10;
    this.value = (opts.initial ?? '').slice(0, this.maxLen);

    let cy = 0;
    if (opts.title) { this.add(bigText(scene, 0, 40, opts.title, 64, MENU.yellow, { font: FONT_HEAD })); cy = 100; }

    // name box: static background drawn once
    this.box = scene.add.container(0, cy + BOX_H / 2);
    const bg = scene.add.graphics();
    bg.fillStyle(0x0b1530, 1).fillRoundedRect(-GRID_W / 2, -BOX_H / 2, GRID_W, BOX_H, 28);
    bg.lineStyle(8, 0xffffff, 1).strokeRoundedRect(-GRID_W / 2, -BOX_H / 2, GRID_W, BOX_H, 28);
    this.textObj = bigText(scene, 0, 0, '', 80, MENU.white, { font: FONT_HEAD });
    this.cursor = scene.add.rectangle(0, 0, 8, 80, 0xffd43b);
    scene.tweens.add({ targets: this.cursor, alpha: 0.1, duration: 450, yoyo: true, repeat: -1 });
    this.box.add([bg, this.textObj, this.cursor]);
    this.add(this.box);

    // keys: one static Graphics (drawn once) + one moving highlight rectangle
    const top = cy + BOX_H + 40;
    const kg = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];
    this.hi = scene.add.rectangle(0, 0, KEY, KEY, this.color, 1).setStrokeStyle(8, 0xffffff, 1);
    this.rows.forEach((row, r) => row.forEach((k) => {
      const w = k.span * PITCH - GAP;
      const kx = -GRID_W / 2 + k.col * PITCH + w / 2;
      const ky = top + r * PITCH + KEY / 2;
      this.keyBoxes.set(k, { x: kx, y: ky, w });
      kg.fillStyle(MENU.panel, 1).fillRoundedRect(kx - w / 2, ky - KEY / 2, w, KEY, 24);
      kg.lineStyle(5, 0x7f94d6, 1).strokeRoundedRect(kx - w / 2, ky - KEY / 2, w, KEY, 24);
      labels.push(bigText(scene, kx, ky, k.label, k.kind === 'letter' ? 64 : 52, MENU.white, { font: FONT_HEAD }));
    }));
    this.add([kg, this.hi, ...labels]);

    this.refresh();
    scene.add.existing(this);
    // Native listener: exactly one event per press (Phaser's queued 'keydown' doubled fast typing).
    if (opts.keyboardTyping !== false) globalThis.addEventListener?.('keydown', this.onKeyDown);
  }

  setColor(color: number): this {
    this.color = color;
    this.hi.setFillStyle(color, 1);
    return this;
  }

  private cur(): PickerKey { return this.rows[this.pos.row][this.pos.idx]; }

  private refresh() {
    const b = this.keyBoxes.get(this.cur())!;
    this.hi.setPosition(b.x, b.y).setSize(b.w + 8, KEY + 8);
    this.textObj.setText(this.value);
    const full = this.value.length >= this.maxLen;
    const w = this.value ? this.textObj.width : 0;
    this.textObj.x = full ? 0 : -10;
    this.cursor.x = this.textObj.x + w / 2 + 14;
    this.cursor.setVisible(!full);
  }

  private bump() {
    this.scene.tweens.add({ targets: this.box, x: { from: -16, to: 0 }, duration: 240, ease: 'Bounce.Out' });
  }

  private sfx(n: 'menuMove' | 'menuSelect') { services.audio?.sfx(n); }

  private add1(ch: string) {
    const v = appendChar(this.value, ch, this.maxLen);
    if (v === this.value) { this.bump(); return; }
    this.value = v; this.sfx('menuSelect'); this.refresh();
  }

  private del(): boolean {
    if (!this.value) return false;
    this.value = deleteLast(this.value); this.sfx('menuSelect'); this.refresh();
    return true;
  }

  private finish(): PickerResult {
    if (isValidName(this.value)) { this.value = this.value.trim(); this.refresh(); this.sfx('menuSelect'); return 'done'; }
    this.bump();
    return 'none';
  }

  private typed(e: KeyboardEvent) {
    if (!this.active || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) this.add1(e.key.toUpperCase());
    else if (e.key === ' ') this.add1(' ');
    else if (e.key === 'Backspace') this.del();
    else if (e.key === 'Enter') { if (isValidName(this.value)) this.pending = this.finish(); else this.bump(); }
  }

  /** Call every frame with the owning player's input edges. Also reports 'done' from a physical-keyboard Enter. */
  handle(inp: { navX: number; navY: number; confirm: boolean; back: boolean }): PickerResult {
    if (this.pending !== 'none') { const r = this.pending; this.pending = 'none'; return r; }
    if (inp.navX || inp.navY) {
      this.pos = moveCursor(this.rows, this.pos, inp.navX, inp.navY);
      this.sfx('menuMove'); this.refresh();
    }
    if (inp.back) return this.del() ? 'none' : 'cancel';
    if (inp.confirm) {
      const k = this.cur();
      if (k.kind === 'letter') this.add1(k.label);
      else if (k.kind === 'space') this.add1(' ');
      else if (k.kind === 'delete') { if (!this.del()) this.bump(); }
      else return this.finish();
    }
    return 'none';
  }

  override destroy(fromScene?: boolean): void {
    globalThis.removeEventListener?.('keydown', this.onKeyDown);
    super.destroy(fromScene);
  }
}
