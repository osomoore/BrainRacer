import Phaser from 'phaser';
import { carArt } from '../../art/loadoutKeys';
import { UNLOCK_VEHICLES } from '../../config/collectibles';
import type { CarKind, ControllerFamily, InputDevice } from '../../core/types';

export { buddyName as guideName } from '../../../shared/buddies/catalog';
export { FONT_HEAD, FONT_BODY, MIN_TEXT, MENU, hexNum, bigText, arrowShape, drawArrow, drawJoinPanelFrame } from '../../../shared/ui/menu/style';
export type { BigTextOpts, Selectable } from '../../../shared/ui/menu/style';

/** Racer-specific car picture (texture if the art package has landed, else a simple colored shape). Faces +x. */
export function carPreview(scene: Phaser.Scene, kind: CarKind, x: number, y: number, scale: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const key = carArt(kind);
  if (scene.textures.exists(key)) {
    const art = scene.add.image(0, 0, key);
    if (kind !== 'dino' && kind !== 'kart') {
      const { length, width } = UNLOCK_VEHICLES[kind].spec;
      art.setDisplaySize(length, width);
    }
    c.add(art);
  } else {
    const w = kind === 'dino' ? 72 : 60, h = kind === 'dino' ? 40 : 36;
    c.add(scene.add.rectangle(0, 0, w, h, kind === 'dino' ? 0x2ecc40 : 0xff3b30).setStrokeStyle(3, 0x000000));
    c.add(scene.add.rectangle(w * 0.15, 0, w * 0.3, h * 0.6, 0xffffff, 0.6));
  }
  return c.setScale(scale);
}
export function carName(kind: CarKind): string {
  if (kind === 'dino') return 'Dino-Car';
  if (kind === 'kart') return 'Red Kart';
  return UNLOCK_VEHICLES[kind].name;
}
export function deviceLabel(d: InputDevice, family?: ControllerFamily): string {
  if (d.type === 'gamepad') {
    if (family === 'nintendo') return 'Switch Pro Controller';
    if (family === 'xbox') return 'Xbox Controller';
    return `🎮 Controller ${d.index + 1}`;
  }
  if (d.type === 'touch') return 'Touch';
  return d.layout === 'left' ? '⌨ WASD' : '⌨ Arrows';
}
