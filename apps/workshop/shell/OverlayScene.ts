/** Always-on top layer: the 2P divider, the Admin Mode pill and (mobile) the faint admin gear. */
import Phaser from 'phaser';
import { STAGE, WS_ADMIN, WS_UI } from '../config';
import { COLORS, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { shell } from './shell';

const GEAR = 'ws:gear';

function gearTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(GEAR)) return GEAR;
  const s = 96, c = s / 2;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.fillPoints([
      new Phaser.Geom.Point(c + Math.cos(a - 0.22) * 32, c + Math.sin(a - 0.22) * 32),
      new Phaser.Geom.Point(c + Math.cos(a - 0.16) * 46, c + Math.sin(a - 0.16) * 46),
      new Phaser.Geom.Point(c + Math.cos(a + 0.16) * 46, c + Math.sin(a + 0.16) * 46),
      new Phaser.Geom.Point(c + Math.cos(a + 0.22) * 32, c + Math.sin(a + 0.22) * 32),
    ], true);
  }
  g.fillCircle(c, c, 34);
  g.fillStyle(0x000000, 1).fillCircle(c, c, 14);
  g.generateTexture(GEAR, s, s);
  g.destroy();
  return GEAR;
}

export class OverlayScene extends Phaser.Scene {
  private divider?: Phaser.GameObjects.Rectangle;
  private adminPill?: Phaser.GameObjects.Container;
  private gear?: Phaser.GameObjects.Image;
  private zone?: Phaser.GameObjects.Zone;

  constructor() { super('overlay'); }

  create(): void {
    this.cameras.main.setViewport(0, 0, STAGE.w, STAGE.h);
    const dw = WS_UI.dividerW;
    this.divider = this.add.rectangle(STAGE.w / 2, STAGE.h / 2, dw, STAGE.h, COLORS.ink).setVisible(false);
    this.add.rectangle(STAGE.w / 2, STAGE.h / 2, 3, STAGE.h, 0xffffff).setVisible(false).setName('dividerLine');

    const { inset, h, padX, font } = WS_UI.adminPill;
    const t = makeText(this, 0, 0, 'ADMIN MODE', { size: font, color: COLORS.ink, small: true });
    const w = Math.ceil(t.width) + 2 * padX;
    this.adminPill = this.add.container(STAGE.w - inset - w / 2, inset + h / 2, [
      this.add.image(0, 0, roundedTexture(this, w, h, COLORS.yellow, { radius: h / 2, shadow: 0, gloss: false })).setOrigin(0.5, roundedOriginY(h, 0)),
      t,
    ]).setSize(w, h).setVisible(false);

    if (shell.mobile) {
      const sz = WS_ADMIN.gearSize;
      const x = STAGE.w - WS_ADMIN.gearHit / 2, y = WS_ADMIN.gearHit / 2;
      this.gear = this.add.image(x, y, gearTexture(this)).setDisplaySize(sz, sz).setAlpha(WS_ADMIN.gearAlpha).setVisible(false);
      this.zone = this.add.zone(x, y, WS_ADMIN.gearHit, WS_ADMIN.gearHit).setInteractive();
      this.zone.on('pointerdown', () => { if (this.gear?.visible) shell.openAdmin(true); });
      this.zone.input!.enabled = false;
    }
  }

  override update(): void {
    const two = shell.count === 2;
    this.divider?.setVisible(two);
    this.children.getByName('dividerLine') && (this.children.getByName('dividerLine') as Phaser.GameObjects.Rectangle).setVisible(two);
    if (this.adminPill) {
      const edge = WS_UI.adminPill.inset + this.adminPill.width / 2;
      // The tall board puts its part labels in the upper right. Its model side has room above it.
      const rightBoard = two && shell.panes[1]?.screenId === 'board';
      const x = rightBoard ? STAGE.w / 2 + WS_UI.dividerW / 2 + edge : STAGE.w - edge;
      this.adminPill.setX(x).setVisible(shell.adminMode() && !shell.adminOpen);
    }
    if (this.gear && this.zone) {
      const show = !shell.adminOpen && (shell.count === 0 || (shell.count === 1 && shell.panes[0]?.screenId === 'profile'));
      this.gear.setVisible(show);
      this.zone.input!.enabled = show;
    }
  }
}
