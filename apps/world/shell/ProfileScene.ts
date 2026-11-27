import Phaser from 'phaser';
import { goToGame } from '../../../shared/hub';
import { sameDevice, type DeviceAction, type DeviceId, type DeviceInput } from '../../../shared/input/deviceInput';
import { listProfiles, type PlayerProfile } from '../../../shared/profiles';
import { familySync } from '../../../shared/sync/runtime';
import { bigText, FONT_HEAD, MENU } from '../../../shared/ui/menu/style';
import { Button } from '../../workshop/ui/Button';
import { WORLD } from '../config';
import type { WorldPlayer } from './WorldScene';

const COLUMNS = 4;
const PAGE_SIZE = 2 * COLUMNS;

/** Each joined device selects a profile in join order. */
export class ProfileScene extends Phaser.Scene {
  private joined: readonly DeviceId[] = [];
  private players: WorldPlayer[] = [];
  private profiles: PlayerProfile[] = [];
  private cursor = 0;
  private leaving = false;
  private cards: Phaser.GameObjects.GameObject[] = [];
  private heading!: Phaser.GameObjects.Text;
  private workshop!: Button;

  constructor(private readonly devices: DeviceInput, private readonly mobile: boolean) { super('Profiles'); }

  create({ devices }: { devices: readonly DeviceId[] }): void {
    this.joined = devices;
    this.players = [];
    this.cards = [];
    this.leaving = false;
    this.cursor = 0;
    const { width, height } = WORLD;
    this.add.rectangle(width / 2, height / 2, width, height, 0x267e72);
    this.add.ellipse(width / 2, height, width * 1.2, 330, 0x45a877).setAlpha(0.65);
    this.heading = bigText(this, width / 2, 130, '', 76, MENU.yellow, { font: FONT_HEAD });
    new Button(this, { x: 200, y: height - 90, w: 270, h: 82, label: 'Back', fontSize: 42,
      badge: this.mobile ? undefined : 'B', onClick: () => this.goBack() });
    this.workshop = new Button(this, { x: width / 2, y: height - 90, w: 700, h: 82,
      label: 'Make a profile in Workshop', fontSize: 44, color: 0xffc35d, onClick: () => this.openWorkshop() });
    this.refreshProfiles();
    const unsubscribe = familySync.subscribeProfiles(() => this.refreshProfiles());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  private refreshProfiles(): void {
    if (this.leaving) return;
    const selected = this.profiles[this.cursor]?.id;
    this.profiles = listProfiles().filter(profile => !this.players.some(player => player.profile.id === profile.id));
    this.cursor = Math.max(0, this.profiles.findIndex(profile => profile.id === selected));
    this.drawProfiles();
  }

  private drawProfiles(): void {
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    const page = Math.floor(Math.min(this.cursor, Math.max(0, this.profiles.length - 1)) / PAGE_SIZE);
    const start = page * PAGE_SIZE;
    const shown = this.profiles.slice(start, start + PAGE_SIZE);
    const center = WORLD.width / 2;
    this.heading.setText(`Player ${this.players.length + 1}, pick your profile`);
    this.workshop.setFocused(!this.mobile && this.cursor === this.profiles.length);
    if (shown.length === 0) {
      this.cards.push(bigText(this, center, 465, 'Make a profile in Adventure Workshop to play.', 54));
    }
    shown.forEach((profile, i) => {
      const row = Math.floor(i / COLUMNS);
      const rowLength = Math.min(COLUMNS, shown.length - row * COLUMNS);
      const x = center + (i % COLUMNS - (rowLength - 1) / 2) * 390;
      this.cards.push(new Button(this, { x, y: 365 + row * 205, w: 340, h: 150, label: profile.name,
        onClick: () => this.choose(start + i) }).setFocused(!this.mobile && this.cursor === start + i));
    });
    const pageCount = Math.ceil(this.profiles.length / PAGE_SIZE);
    if (pageCount > 1) {
      this.cards.push(bigText(this, center, 785, `Page ${page + 1} of ${pageCount}`, 44));
      this.cards.push(new Button(this, { x: center - 330, y: 785, w: 270, h: 74, label: 'Previous', fontSize: 42,
        onClick: () => this.setCursor(start - PAGE_SIZE) }).setEnabled(page > 0));
      this.cards.push(new Button(this, { x: center + 330, y: 785, w: 270, h: 74, label: 'Next', fontSize: 42,
        onClick: () => this.setCursor(start + PAGE_SIZE) }).setEnabled(page + 1 < pageCount));
    }
  }

  private setCursor(index: number): void {
    const next = Phaser.Math.Clamp(index, 0, this.profiles.length);
    if (next === this.cursor) return;
    this.cursor = next;
    this.drawProfiles();
  }

  private choose(index: number): void {
    if (this.leaving) return;
    const profile = this.profiles[index];
    if (!profile) { this.openWorkshop(); return; }
    const device = this.joined[this.players.length];
    this.players.push({ profile, device });
    if (this.players.length === this.joined.length) {
      this.leaving = true;
      this.scene.start('World', { players: this.players });
    } else {
      this.refreshProfiles();
    }
    familySync.chooseProfile(profile.id);
  }

  private openWorkshop(): void {
    if (this.leaving) return;
    this.leaving = true;
    goToGame('workshop', '?from=world');
  }

  private goBack(): void {
    if (this.leaving) return;
    if (this.players.length) {
      this.players.pop();
      this.refreshProfiles();
    } else {
      this.leaving = true;
      this.scene.start('Title');
    }
  }

  private action(action: DeviceAction): void {
    switch (action) {
      case 'left': this.setCursor(this.cursor - 1); break;
      case 'right': this.setCursor(this.cursor + 1); break;
      case 'up': this.setCursor(this.cursor - COLUMNS); break;
      case 'down': this.setCursor(this.cursor + COLUMNS); break;
      case 'confirm': this.choose(this.cursor); break;
      case 'back': this.goBack(); break;
    }
  }

  override update(): void {
    const device = this.joined[this.players.length];
    const events = this.devices.poll();
    if (!device) return;
    for (const event of events) {
      if (this.leaving) break;
      if (event.type === 'action' && sameDevice(event.device, device)) this.action(event.action);
    }
  }
}
