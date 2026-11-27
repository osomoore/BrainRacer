import Phaser from 'phaser';
import { isMobile } from '../../../shared/device';
import { BUTTONS, WORLD } from '../config';
import { DEPTH, type WorldContext, type WorldModule, type WorldPlayer } from '../core/runtime';
import { hexToWorld } from '../gen/hex';
import { touchModeWanted } from '../input/touchMapping';
import { CLOSED, PAUSE_OPTIONS, StickNav, stepCard, type CardAction, type CardEvent, type CardState } from './cards';
import { bakeDisc, bakeIcons, bakePlate, iconKey, type IconName } from './icons';
import { padConnected } from './questDialog';
import { QuestHud } from './questHud';

const KEY = 'WorldButtons';
const FONT = 'Arial Black, Arial, sans-serif';
const PAD_IDS = ['a', 'b', 'x', 'y'] as const;
const LEGEND_ICONS: Record<typeof PAD_IDS[number], IconName> = { a: 'hand', b: 'horn', x: 'swap', y: 'lab' };
const C = BUTTONS.card;
const ROW_W = C.width - 120;
const PAUSE_HEIGHT = 816;

type Obj = Phaser.GameObjects.GameObject;
const vis = (list: Obj[], on: boolean) => list.forEach(o => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on));

/** Screen-space UI lives in its own scene so the heading-up world cameras never rotate it (same idea as TouchScene). */
class HudScene extends Phaser.Scene {
  constructor(private readonly onReady: (s: Phaser.Scene) => void) { super(KEY); }
  create(): void { this.onReady(this); }
}

interface View {
  player: WorldPlayer;
  state: CardState;
  ownsBusy: boolean;
  nav: StickNav;
  taps: CardEvent[];
  legend: Obj[];
  dim: Phaser.GameObjects.Image;
  lab: Obj[];
  /** Pad letters on the Lab buttons (hidden for touch players). */
  labPad: Obj[];
  pause: Obj[];
  quests: Obj[];
  questsPad: Obj[];
  /** Pad selection marker on the pause card. */
  sel: Obj[];
  selPad: Obj[];
  rowY: number[];
  honkCooldown: number;
}

interface Fx {
  img: Phaser.GameObjects.Image; player: WorldPlayer | null; delay: number; t: number; dur: number; from: number; to: number;
}

export default class ButtonsModule implements WorldModule {
  static order = 400;
  private ctx!: WorldContext;
  private views: View[] = [];
  private fx: Fx[] = [];
  private touchMode = false;
  private padHints = true;
  private quests!: QuestHud;

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.touchMode = touchModeWanted(location.search, isMobile(), ctx.players.length);
    this.quests = new QuestHud(ctx);
    bakeIcons(ctx.scene);
    this.bakeWorldFx(ctx.scene);
    const manager = ctx.scene.scene;
    if (manager.get(KEY)) manager.remove(KEY);
    manager.add(KEY, new HudScene(s => this.build(s)), true);
  }

  update(dt: number): void {
    this.padHints = padConnected();
    for (const v of this.views) {
      v.honkCooldown = Math.max(0, v.honkCooldown - dt);
      this.step(v);
      this.showView(v);
      this.quests.updatePlayer(v.player, v.state.kind);
    }
    this.quests.update();
    this.updateFx(dt);
  }

  destroy(): void {
    for (const v of this.views) if (v.ownsBusy) v.player.busy = false;
    this.views = [];
    for (const f of this.fx) f.img.destroy();
    this.fx = [];
    this.quests.destroy();
    const manager = this.ctx.scene.scene;
    if (manager.get(KEY)) manager.remove(KEY);
  }

  // ---- input -> card state -------------------------------------------------------------------

  private step(v: View): void {
    const p = v.player;
    const pr = p.controls.pressed;
    const open = v.state.kind !== 'closed';
    const events: CardEvent[] = v.taps.splice(0);
    if (!open && p.busy) return;
    if (pr.a) events.push({ type: 'press', button: 'a' });
    if (pr.b) events.push({ type: 'press', button: 'b' });
    if (pr.y) events.push({ type: 'press', button: 'y' });
    if (pr.menu) events.push({ type: 'press', button: 'menu' });
    const dir = v.nav.step(p.controls.y, BUTTONS.navThreshold, BUTTONS.navRelease);
    if (dir !== 0) events.push({ type: 'nav', dir });
    if (!open && pr.b && !pr.y && !pr.menu && v.honkCooldown <= 0) this.honk(v);
    for (const e of events) {
      const previous = v.state.kind;
      const was = previous !== 'closed';
      const r = stepCard(v.state, e);
      v.state = r.state;
      const now = v.state.kind !== 'closed';
      if (!was && now) { v.ownsBusy = !p.busy; p.busy = true; }
      if (was && !now) { if (v.ownsBusy) p.busy = false; v.ownsBusy = false; }
      if (r.action) this.run(v, r.action);
      if (previous !== r.state.kind) break;
    }
  }

  private run(v: View, action: CardAction): void {
    const { ctx } = this;
    if (action === 'lab') ctx.bus.emit('nav:workshop', { player: v.player });
    else if (action === 'home') this.goHome(v.player);
    else if (action === 'exit') ctx.scene.scene.start('Title');
  }

  private goHome(p: WorldPlayer): void {
    const hex = this.ctx.world.homeFor(p.profileId);
    if (!hex) return;
    const at = hexToWorld(hex);
    this.poof(p.move.x, p.move.y);
    p.move.x = at.x; p.move.y = at.y; p.move.vx = 0; p.move.vy = 0; p.move.airborne = 0; delete p.move.jump;
    this.poof(at.x, at.y);
    this.ctx.bus.emit('player:respawn', { player: p, at });
  }

  private honk(v: View): void {
    const h = BUTTONS.honk;
    v.honkCooldown = h.cooldown;
    const tint = v.player.traits.kind === 'dino' ? 0xff9a3c : 0xffffff;
    // TODO(audio): play the honk / roar sound here once the audio service exists.
    for (let i = 0; i < h.rings; i++) {
      const img = this.ctx.scene.add.image(v.player.move.x, v.player.move.y, 'world-ring').setDepth(DEPTH.popups).setTint(tint).setVisible(false);
      this.fx.push({ img, player: v.player, delay: i * h.stagger, t: 0, dur: h.seconds, from: h.startScale, to: h.endScale });
    }
  }

  private poof(x: number, y: number): void {
    const img = this.ctx.scene.add.image(x, y, 'world-poof').setDepth(DEPTH.popups).setVisible(false);
    this.fx.push({ img, player: null, delay: 0, t: 0, dur: BUTTONS.poof.seconds, from: 0.4, to: BUTTONS.poof.scale });
  }

  private updateFx(dt: number): void {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      if (f.player) f.img.setPosition(f.player.move.x, f.player.move.y);
      const ease = 1 - (1 - k) * (1 - k);
      const s = (f.from + (f.to - f.from) * ease) * (BUTTONS.honk.size / 256);
      f.img.setVisible(true).setScale(s).setAlpha(1 - k);
      if (k >= 1) { f.img.destroy(); this.fx.splice(i, 1); }
    }
  }

  // ---- drawing -------------------------------------------------------------------------------

  private showView(v: View): void {
    const kind = v.state.kind;
    vis(v.legend, this.padHints && kind === 'closed');
    v.dim.setVisible(kind !== 'closed');
    vis(v.lab, kind === 'lab');
    vis(v.labPad, kind === 'lab' && this.padHints);
    vis(v.pause, kind === 'pause');
    vis(v.quests, kind === 'quests');
    vis(v.questsPad, kind === 'quests' && this.padHints);
    vis(v.sel, kind === 'pause' && (!this.touchMode || this.padHints));
    vis(v.selPad, kind === 'pause' && this.padHints);
    if (v.state.kind === 'pause') {
      const y = v.rowY[v.state.sel];
      for (const o of [...v.sel, ...v.selPad]) (o as unknown as Phaser.GameObjects.Components.Transform).y = y;
    }
  }

  private bakeWorldFx(scene: Phaser.Scene): void {
    const size = 256;
    if (!scene.textures.exists('world-ring')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.lineStyle(22, 0xffffff, 0.35).strokeCircle(size / 2, size / 2, size / 2 - 14);
      g.lineStyle(10, 0xffffff, 1).strokeCircle(size / 2, size / 2, size / 2 - 14);
      g.generateTexture('world-ring', size, size);
      g.destroy();
    }
    if (!scene.textures.exists('world-poof')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 0.95);
      for (const [x, y, r] of [[128, 128, 62], [84, 108, 40], [172, 108, 42], [96, 164, 38], [162, 164, 40], [128, 82, 34]]) g.fillCircle(x, y, r);
      g.generateTexture('world-poof', size, size);
      g.destroy();
    }
  }

  private build(scene: Phaser.Scene): void {
    const { ctx } = this;
    const n = ctx.players.length;
    const W = WORLD.width / n;
    const D = BUTTONS.depth;
    const L = BUTTONS.legend;
    bakeIcons(scene);
    this.quests.build(scene, this.touchMode);
    const legendW = PAD_IDS.length * (L.glyph + 8 + L.icon) + (PAD_IDS.length - 1) * L.gap + 40;
    const legendH = L.icon + 28;
    bakePlate(scene, 'world-legend-bg', legendW, legendH, 0x102b35, 0.62, 30);
    for (const id of PAD_IDS) bakeDisc(scene, `world-disc:${id}`, L.glyph / 2, BUTTONS.colors[id]);
    bakeDisc(scene, 'world-disc:a-big', 24, BUTTONS.colors.a);
    bakeDisc(scene, 'world-disc:b-big', 24, BUTTONS.colors.b);
    bakePlate(scene, 'world-card-panel', C.width, 560, 0x16264a, 0.96, 44);
    bakePlate(scene, 'world-card-panel-tall', C.width, PAUSE_HEIGHT, 0x16264a, 0.96, 44);
    bakePlate(scene, 'world-card-yes', C.btnWidth, C.btnHeight, BUTTONS.colors.a, 1, 36);
    bakePlate(scene, 'world-card-no', C.btnWidth, C.btnHeight, BUTTONS.colors.b, 1, 36);
    bakePlate(scene, 'world-row-resume', ROW_W, C.rowHeight, BUTTONS.colors.a, 1, 36);
    bakePlate(scene, 'world-row-home', ROW_W, C.rowHeight, BUTTONS.colors.y, 1, 36);
    bakePlate(scene, 'world-row-quests', ROW_W, C.rowHeight, BUTTONS.colors.x, 1, 36);
    bakePlate(scene, 'world-row-exit', ROW_W, C.rowHeight, BUTTONS.colors.b, 1, 36);
    if (!scene.textures.exists('world-row-sel')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.lineStyle(10, 0xffffff, 1).strokeRoundedRect(5, 5, ROW_W + 14, C.rowHeight + 14, 44);
      g.generateTexture('world-row-sel', ROW_W + 24, C.rowHeight + 24);
      g.destroy();
    }
    if (!scene.textures.exists('world-dim')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 1).fillRect(0, 0, 8, 8);
      g.generateTexture('world-dim', 8, 8);
      g.destroy();
    }
    const label = (x: number, y: number, text: string, size: number, stroke = 8) =>
      scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', stroke: '#1c2540', strokeThickness: stroke })
        .setOrigin(0.5).setDepth(D + 5);

    for (const player of ctx.players) {
      const vx = player.index * W;
      const cx = vx + W / 2;
      const cy = WORLD.height / 2;
      const view: View = {
        player, state: CLOSED, ownsBusy: false, nav: new StickNav(), taps: [], legend: [], lab: [], labPad: [],
        pause: [], quests: [], questsPad: [], sel: [], selPad: [], rowY: [],
        dim: scene.add.image(cx, cy, 'world-dim').setDisplaySize(W, WORLD.height).setAlpha(C.dim).setDepth(D + 1), honkCooldown: 0,
      };
      const tap = (target: Extract<CardEvent, { type: 'tap' }>['target']) => view.taps.push({ type: 'tap', target });

      // legend, bottom-left of this view
      const lx = vx + L.margin;
      const ly = WORLD.height - L.margin - legendH;
      const ccy = ly + legendH / 2;
      view.legend.push(scene.add.image(lx, ly, 'world-legend-bg').setOrigin(0).setAlpha(L.alpha).setDepth(D));
      let x = lx + 20;
      for (const id of PAD_IDS) {
        view.legend.push(scene.add.image(x + L.glyph / 2, ccy, `world-disc:${id}`).setDepth(D + 1));
        view.legend.push(label(x + L.glyph / 2, ccy - 1, id.toUpperCase(), 34, 6));
        view.legend.push(scene.add.image(x + L.glyph + 8 + L.icon / 2, ccy, iconKey(LEGEND_ICONS[id])).setDisplaySize(L.icon, L.icon).setDepth(D + 1));
        x += L.glyph + 8 + L.icon + L.gap;
      }

      // Lab card
      const by = cy + 170;
      view.lab.push(scene.add.image(cx, cy, 'world-card-panel').setDepth(D + 2));
      view.lab.push(label(cx, cy - 215, 'Go to the Lab?', C.titleSize));
      view.lab.push(scene.add.image(cx, cy - 60, iconKey('lab')).setDisplaySize(200, 200).setDepth(D + 3));
      const mkBtn = (bx: number, plate: string, icon: IconName, letter: 'a' | 'b', target: 'yes' | 'no') => {
        const b = scene.add.image(bx, by, plate).setDepth(D + 3).setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => tap(target));
        view.lab.push(b, scene.add.image(bx, by, iconKey(icon)).setDisplaySize(100, 100).setDepth(D + 4));
        const gx = bx - C.btnWidth / 2 + 6, gy = by - C.btnHeight / 2 + 6;
        view.labPad.push(scene.add.image(gx, gy, `world-disc:${letter}-big`).setDepth(D + 4), label(gx, gy - 1, letter.toUpperCase(), 30, 5));
      };
      mkBtn(cx - 160, 'world-card-yes', 'tick', 'a', 'yes');
      mkBtn(cx + 160, 'world-card-no', 'cross', 'b', 'no');

      // pause card
      const panelH = PAUSE_HEIGHT;
      view.pause.push(scene.add.image(cx, cy, 'world-card-panel-tall').setDepth(D + 2));
      view.pause.push(scene.add.image(cx - 130, cy - panelH / 2 + 80, iconKey('pause')).setDisplaySize(80, 80).setDepth(D + 3));
      view.pause.push(label(cx + 30, cy - panelH / 2 + 80, 'Paused', C.titleSize));
      const rowDefs: { id: typeof PAUSE_OPTIONS[number]; icon: IconName; text: string }[] = [
        { id: 'resume', icon: 'play', text: 'Resume' }, { id: 'home', icon: 'home', text: 'Go Home' },
        { id: 'quests', icon: 'quest', text: 'Quests' }, { id: 'exit', icon: 'exit', text: 'Exit' },
      ];
      rowDefs.forEach((row, i) => {
        const ry = cy - panelH / 2 + 210 + i * (C.rowHeight + C.rowGap);
        view.rowY.push(ry);
        const b = scene.add.image(cx, ry, `world-row-${row.id}`).setDepth(D + 3).setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => tap(row.id));
        view.pause.push(b, scene.add.image(cx - ROW_W / 2 + 80, ry, iconKey(row.icon)).setDisplaySize(96, 96).setDepth(D + 4),
          label(cx + 30, ry, row.text, C.fontSize));
      });
      view.sel.push(scene.add.image(cx, view.rowY[0], 'world-row-sel').setDepth(D + 5));
      view.selPad.push(scene.add.image(cx + ROW_W / 2 - 44, view.rowY[0], 'world-disc:a-big').setDepth(D + 5));
      view.selPad.push(label(cx + ROW_W / 2 - 44, view.rowY[0] - 1, 'A', 30, 5));

      const backY = cy + 307;
      const back = scene.add.image(cx, backY, 'world-row-home').setDepth(D + 3).setInteractive({ useHandCursor: true });
      back.on('pointerdown', () => tap('back'));
      view.quests.push(scene.add.image(cx, cy, 'world-card-panel-tall').setDepth(D + 2),
        label(cx, cy - panelH / 2 + 52, 'Quests', C.titleSize), back, label(cx, backY, 'Back', C.fontSize));
      const backHintX = cx + ROW_W / 2 - 44;
      view.questsPad.push(scene.add.image(backHintX, backY, 'world-disc:b-big').setDepth(D + 5),
        label(backHintX, backY - 1, 'B', 30, 5));

      vis([view.dim, ...view.legend, ...view.lab, ...view.labPad, ...view.pause, ...view.quests, ...view.questsPad,
        ...view.sel, ...view.selPad], false);
      this.views.push(view);
    }
  }
}
