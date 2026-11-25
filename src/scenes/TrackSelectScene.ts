import Phaser from 'phaser';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../config/gameConfig';
import { MAP_LABEL, RACE_MAPS } from '../core/progression';
import { applyRacerProfile, playerRacer, racerName, racerProfiles } from '../core/racerProfiles';
import { loadAllProgress, racerProgressOf, teamMaps, teamPlayableMap } from '../core/racerProgress';
import { services } from '../core/services';
import { loadSettings, loadoutForProfile, saveSettings } from '../core/settings';
import type { PlayerId, RaceMap, Settings } from '../core/types';
import type { MusicTrack } from '../core/types';
import { isQueuedMap } from '../config/queuedMaps';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { stepMap } from '../ui/menu/trackLogic';
import { MenuButton } from '../ui/menu/MenuButton';
import { bigText, FONT_HEAD, hexNum } from '../ui/menu/style';
import { REG, SCENE } from './keys';
import { duplicateProfileSlots } from '../ui/menu/joinLogic';
import { resolveProfileId } from '../../shared/profiles';

const COLS = 4;
const TILE_W = 440, TILE_H = 140, TILE_GAP = 20;
const GRID_TOP = 215;
const START_GRACE_MS = 400;
const TILE_TINT = [0x1372cc, 0x513173, 0x007d93, 0x623dad, 0xba641e, 0x3d70c7, 0x216457, 0x126eb3, 0x608d3e, 0x8e4d91, 0x3875a6, 0x8f4138, 0xb35c9c, 0x34679a, 0x357a9f, 0xb57055];

/**
 * Track select: Player 1 picks the world and presses Start. Other players just watch.
 * Locked worlds (not owned by any racer of the team) are shown dimmed and skipped.
 */
export class TrackSelectScene extends Phaser.Scene {
  private settings!: Settings;
  private maps: readonly RaceMap[] = ['city'];
  private map: RaceMap = 'city';
  private tiles: { bg: Phaser.GameObjects.Graphics; map: RaceMap; x: number; y: number }[] = [];
  private startBtn!: MenuButton;
  private leaving = false;
  private enteredAt = 0;

  constructor() { super(SCENE.track); }

  create() {
    this.leaving = false; this.tiles = [];
    this.enteredAt = this.time.now;
    const reg = this.registry.get(REG.settings) as Settings | undefined;
    this.settings = reg?.players?.length ? reg : { ...DEFAULT_SETTINGS, ...loadSettings() };
    const admin = this.settings.developerMode === true;
    const all = loadAllProgress();
    const team = this.settings.players.map((p, i) => racerProgressOf(all, playerRacer(p, i, this.settings)));
    this.maps = team.length ? teamMaps(team, admin) : ['city'];
    this.map = team.length ? teamPlayableMap(this.settings.map, team, admin) : 'city';
    this.playPreview();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => services.audio.music('title', 0.5));

    const g = this.add.graphics();
    g.fillGradientStyle(0x1a2a6c, 0x1a2a6c, 0x2b8cff, 0x2b8cff, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 14; i++) g.fillStyle(0xffffff, i % 2 ? 0.04 : 0.07).fillRect(0, 40 + i * 80, GAME_WIDTH, 40);
    bigText(this, GAME_WIDTH / 2, 70, 'CHOOSE A WORLD!', 96, '#ffd43b', { font: FONT_HEAD, stroke: 14 });
    this.buildTiles();
    this.buildTeam();
    const color = hexNum(PLAYER_COLORS[0]);
    this.startBtn = new MenuButton(this, GAME_WIDTH / 2, 985, 760, 86, 'START RACE!', color, 60);
    const first = this.settings.players[0]?.device;
    if (first?.type === 'gamepad') {
      this.startBtn.add(new FaceButtonBadge(this, -300, 0, 62, 'bottom', services.input.controllerFamily?.(first) ?? 'other'));
    }
    this.startBtn.setSelected(true, color);
    const zone = this.add.zone(0, 0, 780, 120).setInteractive();
    zone.on('pointerdown', () => this.start());
    this.startBtn.add(zone);
    this.refresh();
    services.input.reset();
    this.settings.players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));
  }

  private buildTiles() {
    const totalW = COLS * TILE_W + (COLS - 1) * TILE_GAP;
    const left = (GAME_WIDTH - totalW) / 2 + TILE_W / 2;
    RACE_MAPS.forEach((m, i) => {
      const x = left + (i % COLS) * (TILE_W + TILE_GAP);
      const y = GRID_TOP + Math.floor(i / COLS) * (TILE_H + TILE_GAP) + TILE_H / 2;
      const bg = this.add.graphics().setPosition(x, y);
      const open = this.maps.includes(m);
      bigText(this, x, y - (open ? 0 : 22), MAP_LABEL[m], 44, open ? '#ffffff' : '#9aa6c8');
      if (!open) bigText(this, x, y + 32, 'Locked', 40, '#9aa6c8', { bold: false, shadow: false });
      this.tiles.push({ bg, map: m, x, y });
      if (open) {
        // Tap a world to pick it (the START RACE button starts).
        const z = this.add.zone(x, y, TILE_W, TILE_H).setInteractive();
        z.on('pointerdown', () => this.tapTile(m));
      }
    });
  }

  private buildTeam() {
    const ps = this.settings.players;
    const n = ps.length;
    const step = 470;
    ps.forEach((p, i) => {
      const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * step;
      bigText(this, x, 885, `P${i + 1}  ${racerName(this.settings, playerRacer(p, i, this.settings))}`, 44, PLAYER_COLORS[i], { stroke: 8 });
    });
  }

  private refresh() {
    const color = hexNum(PLAYER_COLORS[0]);
    this.tiles.forEach((t) => {
      const open = this.maps.includes(t.map);
      const sel = t.map === this.map;
      const w = TILE_W, h = TILE_H;
      t.bg.clear();
      if (sel) for (let k = 3; k >= 1; k--) t.bg.fillStyle(color, 0.2).fillRoundedRect(-w / 2 - k * 8, -h / 2 - k * 8, w + k * 16, h + k * 16, 28 + k * 8);
      t.bg.fillStyle(open ? TILE_TINT[RACE_MAPS.indexOf(t.map) % TILE_TINT.length] : 0x2a3350, open ? 0.95 : 0.7).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
      t.bg.lineStyle(sel ? 10 : 4, sel ? 0xffffff : 0xffffff, sel ? 1 : 0.25).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
      t.bg.setScale(1);
    });
  }

  update(time: number) {
    services.input.poll();
    if (this.leaving) return;
    const inp = services.input.get(0);   // only Player 1 drives this screen
    const step = (dx: number, dy: number) => {
      const next = stepMap(RACE_MAPS, this.maps, this.map, dx, dy, COLS);
      if (next !== this.map) { this.map = next; services.audio.sfx('menuMove'); this.refresh(); this.playPreview(); }
    };
    if (inp.navX) step(inp.navX, 0);
    if (inp.navY) step(0, inp.navY);
    if (inp.back) {
      this.leaving = true;
      services.audio.sfx('menuMove');
      const { deletedSlots } = this.persist();
      this.scene.start(SCENE.setup, { keepReady: true, deletedSlots });
      return;
    }
    const comboHeld = inp.brake > 0.5 && inp.throttle > 0.5;
    if ((inp.confirm || (inp.pause && !comboHeld)) && time - this.enteredAt >= START_GRACE_MS) this.start();
  }

  private tapTile(map: RaceMap) {
    if (this.leaving || !this.maps.includes(map)) return;
    if (map === this.map) return;
    this.map = map;
    services.audio.sfx('menuMove');
    this.refresh();
    this.playPreview();
  }

  private playPreview(): void {
    const music = isQueuedMap(this.map) ? this.map : ({
      city: 'race', industrial: 'industrial', farm: 'farm', harbor: 'harbor',
      underground: 'underground', sky: 'sky', forest: 'forest', underwater: 'underwater',
    } as const)[this.map] satisfies MusicTrack;
    services.audio.music(music, 0.5);
  }

  private start() {
    if (this.leaving || this.time.now - this.enteredAt < START_GRACE_MS) return;
    this.leaving = true;
    this.startBtn.pulse();
    services.audio.sfx('menuSelect');
    const { duplicates, deletedSlots } = this.persist();
    if (duplicates || deletedSlots.length) this.scene.start(SCENE.setup, { deletedSlots });
    else this.scene.start(SCENE.race);
  }

  private persist() {
    // Family sync may have refreshed profile settings while this scene was open.
    const latest = loadSettings();
    const preferences = racerProfiles(latest);
    const deletedSlots: number[] = [];
    const players = (this.settings.players.length ? this.settings.players : latest.players).map((player, slot) => {
      const id = player.profile;
      if (typeof id !== 'string') return player;
      const active = resolveProfileId(id);
      if (active === id) return player;
      if (!active) {
        deletedSlots.push(slot);
        return { ...player, profile: undefined };
      }
      return { ...applyRacerProfile({ ...player, profile: active }, slot, { racerProfiles: preferences }), ...loadoutForProfile(active), profile: active };
    });
    const settings: Settings = { ...latest, players, racerProfiles: preferences, map: this.map };
    const duplicates = duplicateProfileSlots(settings.players.map((p, i) => playerRacer(p, i, settings)), settings.players.map(p => p.profile === undefined));
    saveSettings(settings);
    this.registry.set(REG.settings, settings);
    return { duplicates: duplicates.length > 0, deletedSlots };
  }
}
