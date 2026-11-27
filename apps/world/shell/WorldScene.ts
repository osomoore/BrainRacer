import Phaser from 'phaser';
import { sameDevice, type DeviceId, type DeviceInput } from '../../../shared/input/deviceInput';
import type { PlayerProfile } from '../../../shared/profiles';
import { bigText, MENU } from '../../../shared/ui/menu/style';
import { buildRig } from '../../workshop/art';
import { Button } from '../../workshop/ui/Button';
import { WORLD } from '../config';
import { loadPlayerSave } from '../logic/save';
import { worldSeed } from '../logic/seed';
import { activeCreation } from '../logic/slots';

export interface WorldPlayer { profile: PlayerProfile; device: DeviceId }

export class WorldScene extends Phaser.Scene {
  players: readonly WorldPlayer[] = [];
  seed = 0;

  constructor(private readonly devices: DeviceInput) { super('World'); }

  create({ players }: { players: readonly WorldPlayer[] }): void {
    this.players = players;
    this.seed = worldSeed();
    const width = WORLD.width / players.length;
    players.forEach(({ profile }, index) => {
      const left = index * width;
      const camera = index === 0 ? this.cameras.main : this.cameras.add();
      camera.setViewport(left, 0, width, WORLD.height).setScroll(left, 0);
      camera.setBackgroundColor(index === 0 ? '#173e37' : '#193c4b');
      const center = left + width / 2;
      const save = loadPlayerSave(profile.id);
      const creation = activeCreation(profile.id, save);
      bigText(this, center, 145, profile.name, 80, MENU.yellow);
      bigText(this, center, 255, `${save.stars} ${save.stars === 1 ? 'star' : 'stars'}`, 54);
      this.add.ellipse(center, 520, width * 0.68, 360, index === 0 ? 0x255e50 : 0x265367);
      const rig = buildRig(this, creation.workshop, creation.model, 'top');
      rig.root.setPosition(center, 520).setScale(Math.min(width * 0.5 / rig.width, 285 / rig.height));
      bigText(this, center, 830, 'Coming soon', 64);
      if (index === 0) {
        new Button(this, { x: center, y: 975, w: 420, h: 84, label: 'Back to title', fontSize: 46,
          onClick: () => this.scene.start('Title') });
      }
    });
    if (players.length === 2) this.add.rectangle(width, WORLD.height / 2, 12, WORLD.height, 0x102c2c);
  }

  override update(): void {
    const first = this.players[0];
    if (first && this.devices.poll().some(event => event.type === 'action' && event.action === 'back' && sameDevice(event.device, first.device))) {
      this.scene.start('Title');
    }
  }
}
