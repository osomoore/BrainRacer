import Phaser from 'phaser';
import { ADMIN_GATE, DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, NEW_RACER, PLAYER_COLORS } from '../config/gameConfig';
import { applyRacerProfile, createRacer, playerRacer, racerIds, racerName, racerProfiles, racerSettingsOf, withRacerProfile } from '../core/racerProfiles';
import { services } from '../core/services';
import { selectedLoadout } from '../core/progression';
import { loadAllProgress, racerProgressOf, racerLoadouts, teamPlayableMap, type AllProgress } from '../core/racerProgress';
import { isRaceMap, loadoutForProfile, loadSettings, saveSettings, savedSecondPlayer } from '../core/settings';
import type { CarKind, GuideKind, InputDevice, JbqSettings, PlayerId, PlayerSettings, QuestionTypes, RacerProfileId, Settings } from '../core/types';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { allReady, canAdvance, claimSlot, duplicateProfileSlots, isLocked, leaveSlot, newJoinPlayer, nextRacer, setReady, waitingFor, type JoinSlot } from '../ui/menu/joinLogic';
import { JoinPanel, type PanelView } from '../ui/menu/JoinPanel';
import { AdminGate, ensureGearTexture } from '../ui/menu/AdminGate';
import { MenuButton } from '../ui/menu/MenuButton';
import { changeJbq, CHIP_KEYS, jbqLimitNote, jbqPointsLabel, jbqScopeLabel, moveChip, moveRow, ROW_CAR, ROW_DONE, ROW_GUIDE, ROW_POINTS, ROW_QUESTIONS, ROW_RACER, ROW_SCOPE, toggleChip, visibleRow } from '../ui/menu/questionPick';
import { NewRacerPanel } from '../ui/menu/NewRacerPanel';
import { bigText, carName, FONT_HEAD, guideName, hexNum, MENU } from '../ui/menu/style';
import { isMobile } from '../../shared/device';
import { REG, SCENE } from './keys';
import { familySync } from '../../shared/sync/runtime';
import { subscribeProfileReplacements } from '../../shared/sync/changes';
import { syncDotColor } from '../../shared/sync/panel';
import { resolveActiveProfileId, resolveProfileId } from '../../shared/profiles';

/** Stand-in id for "New Profile": matches no shared profile, so no saved progress: only the starter cars/guides and City. */
const NEW_PROFILE_ID = 'new-profile' as RacerProfileId;
const NEXT_GRACE_MS = 500;
type SetupPlayer = PlayerSettings & { questionTypes: QuestionTypes; jbq: JbqSettings };

/** Data passed when entering: `device` = fresh start from Title (that device claims panel 1); otherwise the registry players are restored. */
export interface JoinSceneData { device?: InputDevice; keepReady?: boolean; deletedSlots?: readonly number[] }

/**
 * Join screen: four panels. A device claims the next free panel with its confirm button, then each player picks
 * racer / car / buddy and presses confirm to be Ready (which locks the panel). Only Player 1 can continue, once everyone is ready.
 */
export class SetupScene extends Phaser.Scene {
  private cfg!: Settings & { players: SetupPlayer[] };
  private slots: JoinSlot[] = [];
  private cursors: number[] = [];
  private questionCursors: (number | undefined)[] = [];
  /** Focused Math / Reading / JBQ chip per player. */
  private chipFocus: number[] = [];
  private isNew: boolean[] = [];
  private panels: JoinPanel[] = [];
  private progress!: AllProgress;
  private available: ReturnType<typeof racerLoadouts>[] = [];
  private modeLabel!: Phaser.GameObjects.Text;
  private nextBtn!: MenuButton;
  private nextBadge!: FaceButtonBadge;
  private statusText!: Phaser.GameObjects.Text;
  private leaving = false;
  private lastChangeAt = 0;
  /** Input is ignored until this time (right after the New Profile panel closes, so its confirm press can't leak). */
  private inputBlockedUntil = 0;
  private newPanel?: NewRacerPanel;
  private newPanelPlayer: PlayerId = 0;
  /** Phone/tablet: one player, one centered card, tappable NEXT. */
  private mobile = false;
  private maxPlayers = MAX_PLAYERS;
  private gate?: AdminGate;

  constructor() { super(SCENE.setup); }

  create(data: JoinSceneData = {}) {
    this.mobile = isMobile();
    this.maxPlayers = this.mobile ? 1 : MAX_PLAYERS;
    this.gate = undefined;
    this.leaving = false; this.slots = []; this.cursors = []; this.questionCursors = []; this.chipFocus = []; this.isNew = []; this.panels = []; this.newPanel = undefined;
    const reg = this.registry.get(REG.settings) as Settings | undefined;
    const fresh = !!data.device || !reg?.players?.length;
    const base = fresh ? loadSettings() : reg!;
    this.cfg = {
      ...base,
      players: [],
      map: isRaceMap(base.map) ? base.map : 'city',
      challengeMode: 'words',
      questionStyle: DEFAULT_SETTINGS.questionStyle,
    };
    this.lastChangeAt = this.time.now;
    this.buildBackground();
    bigText(this, GAME_WIDTH / 2, 62, 'GET READY!', 96, '#ffd43b', { font: FONT_HEAD, stroke: 14 });
    this.modeLabel = bigText(this, 36, 62, 'Admin Mode', 40, MENU.dim, { origin: [0, 0.5] });
    this.panels = Array.from({ length: this.maxPlayers }, (_, i) => new JoinPanel(this, i, PLAYER_COLORS[i]));
    if (this.mobile) this.panels[0].setX(GAME_WIDTH / 2); // one card, centered (the A/B buttons sit in the bottom corners)
    this.panels.forEach((pn, i) => { pn.onRowTap = (row, dir) => this.tapRow(i as PlayerId, row, dir);
      pn.onChipTap = (chip) => this.tapChip(i as PlayerId, chip);
    });
    this.buildBottom();

    services.input.reset();
    if (fresh) {
      if (data.device) this.addPlayer(data.device, base.players);
    } else {
      // Returning from Track select / Results: everyone keeps their choices and their Ready state.
      reg!.players.slice(0, this.maxPlayers).forEach((p) => {
        if (!p.device) return;
        this.slots = claimSlot(this.slots, p.device);
        const id = p.profile;
        const active = typeof id === 'string'
          ? (resolveActiveProfileId(id) ?? (resolveProfileId(id) === id ? id : undefined))
          : id;
        const deleted = (active === undefined && id !== undefined) || !!data.deletedSlots?.includes(this.cfg.players.length);
        this.cursors.push(ROW_RACER); this.questionCursors.push(undefined); this.chipFocus.push(0); this.isNew.push(deleted);
        const restored = active ? { ...applyRacerProfile({ ...p, profile: active }, this.cfg.players.length, this.cfg), ...loadoutForProfile(active), profile: active } : { ...p, profile: active };
        this.cfg.players.push(deleted
          ? { ...restored, questionTypes: { ...NEW_RACER.defaultQuestionTypes }, jbq: { ...NEW_RACER.defaultJbq } } as SetupPlayer
          : restored as SetupPlayer);
      });
      this.slots = this.slots.map((s, i) => ({ ...s, ready: data.keepReady === true && !this.mobile && !this.isNew[i] }));
      this.reconcileDuplicateProfiles();
      this.applyRacers();
      this.refreshAvailability();
    }
    this.syncAssign();
    this.refreshAll();
    const color = syncDotColor();
    const dot = color === null ? undefined : this.add.circle(GAME_WIDTH - 122, 40, 11, color).setStrokeStyle(2, 0xffffff);
    const unsubscribeSync = familySync.subscribe(() => { if (dot) dot.setFillStyle(syncDotColor()!); });
    const unsubscribeReplacements = subscribeProfileReplacements((sourceId, targetId) => {
      this.applyProfileReplacement(sourceId, resolveActiveProfileId(targetId));
      this.reconcileDuplicateProfiles();
      this.refreshAvailability();
      this.refreshAll();
    });
    const unsubscribeProfiles = familySync.subscribeProfiles((id) => {
      const latest = loadSettings();
      this.cfg.racerProfiles = racerProfiles(latest);
      this.cfg.players = this.cfg.players.map((player, slot): SetupPlayer => {
        if (player.profile !== id) return player as SetupPlayer;
        const updated = applyRacerProfile(player, slot, this.cfg);
        const loadout = loadoutForProfile(id);
        return { ...updated, ...(loadout ?? {}) } as SetupPlayer;
      });
      this.refreshAvailability();
      this.refreshAll();
    });
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
      unsubscribeSync();
      unsubscribeReplacements();
      unsubscribeProfiles();
    });
  }

  private buildBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a2a6c, 0x1a2a6c, 0x2b8cff, 0x2b8cff, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 14; i++) {
      const y = 40 + i * 80;
      g.fillStyle(0xffffff, i % 2 ? 0.04 : 0.07).fillRect(0, y, GAME_WIDTH, 40);
    }
  }

  private buildBottom() {
    const cx = GAME_WIDTH / 2;
    this.nextBtn = new MenuButton(this, cx, 1015, 760, 86, 'NEXT', hexNum(PLAYER_COLORS[0]), 60);
    this.nextBadge = new FaceButtonBadge(this, -300, 0, 62, 'bottom', 'other');
    this.nextBtn.add(this.nextBadge);
    if (this.mobile) {
      const z = this.add.zone(0, 0, 780, 120).setInteractive();
      z.on('pointerdown', () => { this.nextBtn.pulse(); this.mobileNext(); });
      this.nextBtn.add(z);
    }
    this.statusText = bigText(this, cx, 1015, '', 48, '#ffffff');
    this.buildGear();
  }

  /** The top-right gear opens the multiplication gate before Admin Settings. */
  private buildGear() {
    const { x, y, size, alpha, hit } = ADMIN_GATE.gear;
    this.add.image(x, y, ensureGearTexture(this)).setDisplaySize(size, size).setAlpha(alpha);
    // The hit area extends beyond the icon and stays within the screen.
    const half = hit / 2;
    const zx = Math.min(x, GAME_WIDTH - half), zy = Math.max(y, half);
    const zone = this.add.zone(zx, zy, hit, hit).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.gate || this.leaving || this.newPanel) return;
      this.gate = new AdminGate(this, (ok) => {
        this.gate?.destroy();
        this.gate = undefined;
        this.lastChangeAt = this.time.now;
        if (ok) this.game.events.emit('admin:open');
      });
    });
  }

  // ───────────────────────── model ─────────────────────────
  private syncAssign() {
    services.input.reset();
    this.slots.forEach((s, i) => services.input.assign(i as PlayerId, s.device));
  }

  private addPlayer(device: InputDevice, savedPlayers: readonly PlayerSettings[]) {
    const i = this.slots.length;
    const ids = racerIds(this.cfg);
    const taken = this.cfg.players.map((p, k) => (this.isNew[k] ? undefined : playerRacer(p, k, this.cfg))).filter(Boolean) as RacerProfileId[];
    const prev = savedPlayers[i] ?? (i === 1 ? savedSecondPlayer() : undefined);
    const joined = newJoinPlayer(i, device, prev, savedPlayers[0]?.car, ids, taken, ids[i]);
    const p = joined.profile ? { ...joined, ...loadoutForProfile(joined.profile) } : joined;
    if (p.profile) familySync.chooseProfile(p.profile);
    this.slots = claimSlot(this.slots, device);
    this.cursors.push(ROW_RACER);
    this.questionCursors.push(undefined);
    this.chipFocus.push(0);
    // No free profile (a fresh device, or all taken): the player starts on "New Profile" and makes their racer.
    this.isNew.push(p.profile === undefined);
    this.cfg.players.push((p.profile === undefined ? { ...p, questionTypes: { ...NEW_RACER.defaultQuestionTypes }, jbq: { ...NEW_RACER.defaultJbq } } : applyRacerProfile(p, i, this.cfg)) as SetupPlayer);
    this.refreshAvailability();
  }

  private removePlayer(i: number) {
    this.slots = leaveSlot(this.slots, i);
    this.cursors.splice(i, 1); this.questionCursors.splice(i, 1); this.chipFocus.splice(i, 1); this.isNew.splice(i, 1); this.cfg.players.splice(i, 1);
    this.refreshAvailability();
    this.syncAssign();
  }

  private applyRacers() {
    this.cfg.players = this.cfg.players.map((p, i) => (this.isNew[i] ? p : applyRacerProfile(p, i, this.cfg))) as SetupPlayer[];
  }

  private refreshAvailability() {
    const admin = this.cfg.developerMode === true;
    this.progress = loadAllProgress();
    const team = this.cfg.players.map((p, i) => racerProgressOf(this.progress, this.isNew[i] ? NEW_PROFILE_ID : playerRacer(p, i, this.cfg)));
    this.available = team.map((rp) => racerLoadouts(rp, admin));
    this.cfg.map = team.length ? teamPlayableMap(this.cfg.map, team, admin) : this.cfg.map;
  }

  private refreshAdvanced() {
    const latest = this.registry.get(REG.settings) as Settings | undefined;
    if (!latest) return;
    this.cfg.questionStyle = DEFAULT_SETTINGS.questionStyle;
    this.cfg.challengeIntervalSec = latest.challengeIntervalSec;
    this.cfg.roundLengthSec = latest.roundLengthSec;
    this.cfg.musicVolume = latest.musicVolume;
    this.cfg.sfxVolume = latest.sfxVolume;
    this.cfg.developerMode = latest.developerMode;
    this.cfg.racerProfiles = racerProfiles(latest);
    this.applyRacers();
    this.refreshAvailability();
    this.refreshAll();
  }

  private applyProfileReplacement(sourceId: string, targetId?: string): void {
    this.cfg.racerProfiles = racerProfiles(loadSettings());
    const loadout = targetId ? loadoutForProfile(targetId) : undefined;
    this.cfg.players = this.cfg.players.map((player, slot): SetupPlayer => {
      if (player.profile === undefined || (player.profile !== sourceId && player.profile !== targetId)) return player as SetupPlayer;
      if (!targetId) return this.clearProfileChoice(player, slot);
      this.isNew[slot] = false;
      this.slots = setReady(this.slots, slot, false);
      return { ...applyRacerProfile({ ...player, profile: targetId }, slot, this.cfg), ...loadout };
    });
  }

  private clearProfileChoice(player: PlayerSettings, slot: number): SetupPlayer {
    this.isNew[slot] = true;
    this.slots = setReady(this.slots, slot, false);
    this.cursors[slot] = ROW_RACER;
    this.questionCursors[slot] = undefined;
    this.chipFocus[slot] = 0;
    return { ...player, profile: undefined, questionTypes: { ...NEW_RACER.defaultQuestionTypes }, jbq: { ...NEW_RACER.defaultJbq } };
  }

  /** A merge can make two already-selected slots point at one racer. Keep the first and reopen the later slot. */
  private reconcileDuplicateProfiles(): void {
    const duplicates = new Set(duplicateProfileSlots(
      this.cfg.players.map((player, slot) => playerRacer(player, slot, this.cfg)), this.isNew,
    ));
    this.cfg.players = this.cfg.players.map((player, slot) => duplicates.has(slot)
      ? this.clearProfileChoice(player, slot) : player as SetupPlayer);
  }

  private loadout(player: number): { car: CarKind; guide: GuideKind } {
    return selectedLoadout(this.cfg.players[player], player, this.cfg.developerMode === true, this.available[player]);
  }

  // ───────────────────────── view ─────────────────────────
  private refreshAll() {
    const c = this.cfg;
    this.modeLabel.setVisible(c.developerMode === true);
    const connectedFamily = services.input.controllerFamily?.() ?? 'other';
    this.panels.forEach((panel, i) => {
      panel.setPromptFamily(connectedFamily);
      const s = this.slots[i];
      if (!s) { panel.render(null); return; }
      const p = c.players[i];
      const { car, guide } = this.loadout(i);
      const qCursor = this.questionCursors[i];
      const basics = p.jbq.points === 'basics';
      const view: PanelView = {
        device: s.device,
        family: s.device.type === 'gamepad' ? services.input.controllerFamily?.(s.device) : undefined,
        racer: this.isNew[i] ? 'New Profile' : racerName(c, playerRacer(p, i, c)),
        car: carName(car), guide: guideName(guide), carKind: car, guideKind: guide,
        questions: qCursor === undefined ? undefined : {
          chipsOn: CHIP_KEYS.map((k) => p.questionTypes[k]), chipFocus: this.chipFocus[i],
          jbqPoints: jbqPointsLabel(p.jbq.points), jbqScope: jbqScopeLabel(p.jbq.points, p.jbq.scope), jbqBasics: basics,
          jbqLimit: jbqLimitNote(p.jbq.points, this.slots.length),
          cursor: visibleRow(qCursor, p.questionTypes.jbq, basics),
        },
        cursor: this.cursors[i], ready: s.ready,
        newProfile: this.isNew[i],
      };
      panel.render(view);
    });
    this.refreshBottom();
  }

  private refreshBottom() {
    const ready = allReady(this.slots);
    const first = this.slots[0]?.device;
    const showNext = ready || (this.mobile && this.slots.length > 0 && this.questionCursors[0] === undefined);
    this.nextBtn.setVisible(showNext);
    this.nextBtn.setSelected(showNext, hexNum(PLAYER_COLORS[0]));
    this.statusText.setVisible(!showNext && !this.mobile);
    if (!this.slots.length) this.statusText.setText('Press your button to join!');
    else this.statusText.setText(`Waiting for ${waitingFor(this.slots).map((n) => `P${n}`).join(', ')}…`);
    this.nextBadge.setVisible(first?.type === 'gamepad');
    if (first?.type === 'gamepad') this.nextBadge.setFamily(services.input.controllerFamily?.(first) ?? 'other');
  }

  // ───────────────────────── logic ─────────────────────────
  update(time: number) {
    services.input.poll();
    if (this.leaving || this.gate) return;
    if (this.newPanel) { this.updateNewPanel(); return; }
    if (time < this.inputBlockedUntil) return;
    const hadPlayers = this.slots.length > 0;
    // Both keyboard layouts use Backspace. Closing a submenu takes priority over leaving or unreadying another keyboard slot.
    const keyboardQuestionsOpen = this.slots.some((s, p) => s.device.type === 'keyboard' && this.questionCursors[p] !== undefined);
    for (let p = 0; p < this.slots.length; p++) {
      if (this.handle(p as PlayerId, time, keyboardQuestionsOpen)) return;
    }
    if (this.slots.length < this.maxPlayers) {
      const d = services.input.pollJoin(this.slots.map((s) => s.device));
      if (d) {
        this.addPlayer(d, loadSettings().players);
        this.lastChangeAt = time;
        this.syncAssign();
        services.audio.sfx('join');
        this.refreshAll();
        return;
      }
    }
    if (!hadPlayers && !this.slots.length && services.input.any().back) {
      this.leaving = true;
      services.audio.sfx('menuMove');
      this.scene.start(SCENE.title);
    }
  }

  /** Returns true if the scene is being left (or the list of players changed). */
  private handle(p: PlayerId, time: number, keyboardQuestionsOpen: boolean): boolean {
    const inp = services.input.get(p);
    const questionCursor = this.questionCursors[p];
    if (questionCursor !== undefined) {
      this.handleQuestions(p, inp, questionCursor);
      return false;
    }
    const back = inp.back && !(keyboardQuestionsOpen && this.slots[p].device.type === 'keyboard');
    const locked = isLocked(this.slots, p);
    if (locked) {
      // Ready panels ignore the D-pad. Only P1 may continue; everyone else's confirm does nothing.
      if (back) { this.slots = setReady(this.slots, p, false); services.audio.sfx('menuMove'); this.refreshAll(); return false; }
      const comboHeld = inp.brake > 0.5 && inp.throttle > 0.5;
      if ((inp.confirm || (inp.pause && !comboHeld)) && canAdvance(this.slots, p) && time - this.lastChangeAt >= NEXT_GRACE_MS) {
        this.goNext();
        return true;
      }
      return false;
    }
    const cur = this.cursors[p];
    if (inp.navY && !this.isNew[p]) { // New Profile shows only the racer row
      const n = Phaser.Math.Wrap(cur + (inp.navY > 0 ? 1 : -1), ROW_RACER, ROW_QUESTIONS + 1);
      if (n !== cur) { this.cursors[p] = n; services.audio.sfx('menuMove'); this.refreshAll(); }
    }
    if (inp.navX) this.change(p, this.cursors[p], inp.navX > 0 ? 1 : -1);
    if (inp.confirm) {
      if (this.cursors[p] === ROW_QUESTIONS) { this.showQuestions(p, true); return false; }
      if (this.isNew[p]) { this.openNewPanel(p); return true; }
      this.slots = setReady(this.slots, p, true);
      this.lastChangeAt = time;
      services.audio.sfx('menuSelect');
      this.refreshAll();
      return false;
    }
    if (back) {
      services.audio.sfx('menuMove');
      if (this.mobile) { this.leaving = true; this.scene.start(SCENE.title); return true; }
      this.removePlayer(p);
      this.refreshAll();
      return true;
    }
    return false;
  }

  /** Tap/click on a player card row: same actions as the controller (arrows change the value, the body opens New Profile or cycles). */
  private tapRow(p: PlayerId, row: number, dir: -1 | 0 | 1) {
    if (this.leaving || this.gate || this.newPanel || p >= this.slots.length || isLocked(this.slots, p)) return;
    if (this.questionCursors[p] !== undefined) {
      if (row === ROW_DONE) this.showQuestions(p, false);
      else if (row === ROW_POINTS || row === ROW_SCOPE) {
        const { questionTypes, jbq } = this.cfg.players[p];
        if (visibleRow(row, questionTypes.jbq, jbq.points === 'basics') !== row) return;
        this.questionCursors[p] = row;
        this.changeQuestion(p, row, dir || 1);
      }
      return;
    }
    if (row > ROW_QUESTIONS) return;
    if (this.isNew[p] && row !== ROW_RACER) return;
    if (row === ROW_QUESTIONS) { this.showQuestions(p, true); return; }
    this.cursors[p] = row;
    if (dir === 0 && row === ROW_RACER && this.isNew[p]) { this.openNewPanel(p); return; }
    this.change(p, row, dir || 1);
  }

  /** Tap on a Math / Reading / JBQ chip: focus it and flip it. */
  private tapChip(p: PlayerId, chip: number) {
    if (this.leaving || this.gate || this.newPanel || this.questionCursors[p] === undefined) return;
    this.questionCursors[p] = ROW_QUESTIONS;
    this.chipFocus[p] = chip;
    this.changeQuestion(p, ROW_QUESTIONS, 0);
  }

  /** Mobile NEXT: a new profile opens the name flow first, otherwise the card counts as Ready and we go on. */
  private mobileNext() {
    if (this.leaving || this.gate || this.newPanel || !this.slots.length || this.questionCursors[0] !== undefined) return;
    if (this.isNew[0]) { this.openNewPanel(0); return; }
    this.slots = setReady(this.slots, 0, true);
    this.goNext();
  }

  private showQuestions(p: PlayerId, open: boolean) {
    this.questionCursors[p] = open ? ROW_QUESTIONS : undefined;
    services.audio.sfx(open ? 'menuSelect' : 'menuMove');
    this.refreshAll();
  }

  private handleQuestions(p: PlayerId, inp: ReturnType<typeof services.input.get>, cursor: number) {
    const { questionTypes, jbq } = this.cfg.players[p];
    const basics = jbq.points === 'basics';
    const row = visibleRow(cursor, questionTypes.jbq, basics);
    if (inp.back || (inp.confirm && row === ROW_DONE)) {
      this.showQuestions(p, false);
      return;
    }
    if (inp.navY) {
      this.questionCursors[p] = moveRow(row, inp.navY > 0 ? 1 : -1, questionTypes.jbq, basics);
      services.audio.sfx('menuMove');
      this.refreshAll();
    } else if (inp.navX && row !== ROW_DONE) {
      this.changeQuestion(p, row, inp.navX > 0 ? 1 : -1);
    } else if (inp.confirm && row === ROW_QUESTIONS) {
      this.changeQuestion(p, row, 0);
    }
  }

  private changeQuestion(p: PlayerId, row: number, dir: -1 | 0 | 1) {
    const ps = this.cfg.players[p];
    if (row === ROW_QUESTIONS) {
      if (dir) this.chipFocus[p] = moveChip(this.chipFocus[p], dir);
      else {
        const next = toggleChip(ps.questionTypes, this.chipFocus[p]);
        if (next !== ps.questionTypes) {
          ps.questionTypes = next;
          this.saveQuestions(p);
        }
      }
    } else if (dir && (row === ROW_POINTS || row === ROW_SCOPE)) {
      ps.jbq = changeJbq(ps.jbq, row, dir);
      this.saveQuestions(p);
      const panel = this.panels[p];
      (row === ROW_POINTS ? panel.pointsRow : panel.scopeRow).bump(dir);
    }
    services.audio.sfx('menuMove');
    this.refreshAll();
  }

  /** Cycles a racer, car, or buddy. */
  private change(p: number, row: number, dir: 1 | -1) {
    const c = this.cfg;
    const ps = c.players[p];
    const cycle = <T,>(list: readonly T[], v: T) => list[Phaser.Math.Wrap(list.indexOf(v) + dir, 0, list.length)];
    const panel = this.panels[p];
    let target;
    if (row === ROW_RACER) {
      const takenByOthers = c.players
        .map((o, k) => (k === p || this.isNew[k] ? undefined : playerRacer(o, k, c)))
        .filter(Boolean) as RacerProfileId[];
      const next = nextRacer(racerIds(c), takenByOthers, racerIds(c).length < NEW_RACER.maxCustomRacers, this.isNew[p] ? 'new' : playerRacer(ps, p, c) ?? 'new', dir);
      if (next === 'new') this.isNew[p] = true;
      else {
        this.isNew[p] = false;
        familySync.chooseProfile(next);
        c.players[p] = applyRacerProfile({ ...ps, ...loadoutForProfile(next), profile: next }, p, c) as SetupPlayer;
      }
      this.refreshAvailability();
      target = panel.racerRow;
    } else if (row === ROW_CAR) {
      const value = cycle(this.available[p].cars, this.loadout(p).car);
      if (c.developerMode) ps.devCar = value; else ps.car = value;
      target = panel.carRow;
    } else if (row === ROW_GUIDE) {
      const value = cycle(this.available[p].guides, this.loadout(p).guide);
      if (c.developerMode) ps.devGuide = value; else ps.guide = value;
      target = panel.guideRow;
    }
    if (!target) return;
    services.audio.sfx('menuMove');
    this.refreshAll();
    target.bump(dir);
  }

  /** Saves a player's question choices to their racer profile right away. */
  private saveQuestions(p: number) {
    if (this.isNew[p]) return;
    const ps = this.cfg.players[p];
    const id = playerRacer(ps, p, this.cfg);
    if (!id) return;
    if (ps.profile && resolveActiveProfileId(ps.profile) !== ps.profile) return;
    const profile = { ...racerSettingsOf(this.cfg, id), questionTypes: { ...ps.questionTypes }, jbq: { ...ps.jbq } };
    Object.assign(this.cfg, withRacerProfile(this.cfg, id, profile));
    this.persist({ id, profile });
  }

  private goNext() {
    for (const { profile } of this.cfg.players) {
      const active = resolveProfileId(profile);
      if (profile && active !== profile) this.applyProfileReplacement(profile, active);
    }
    this.reconcileDuplicateProfiles();
    if (!allReady(this.slots)) {
      this.statusText.setText('CHOOSE A RACER FOR EACH PLAYER');
      this.refreshAvailability();
      this.refreshAll();
      return;
    }
    this.leaving = true;
    services.audio.sfx('menuSelect');
    this.applyRacers();
    this.persist();
    this.syncAssign();
    this.scene.start(SCENE.track);
  }

  private persist(profileEdit?: { id: RacerProfileId; profile: ReturnType<typeof racerSettingsOf> }) {
    const latest = loadSettings();
    const profiles = racerProfiles(latest);
    // Setup writes question edits immediately. Bring forward only newly created racers absent from storage.
    for (const id of racerIds(this.cfg)) {
      if (latest.racerProfiles?.[id] === undefined && this.cfg.racerProfiles?.[id]) profiles[id] = this.cfg.racerProfiles[id];
    }
    if (profileEdit && resolveActiveProfileId(profileEdit.id) === profileEdit.id && racerIds(this.cfg).includes(profileEdit.id)) {
      profiles[profileEdit.id] = profileEdit.profile;
    }
    const players = this.cfg.players.map((player, slot) => {
      const id = player.profile;
      // The resolver leaves Racer's supported synthetic IDs intact and canonicalizes retired shared IDs.
      const active = typeof id === 'string'
        ? (resolveActiveProfileId(id) ?? (resolveProfileId(id) === id ? id : undefined))
        : id;
      if (active === id) return player;
      if (active) return { ...applyRacerProfile({ ...player, profile: active }, slot, { racerProfiles: profiles }), ...loadoutForProfile(active), profile: active };
      return { ...player, profile: undefined, questionTypes: { ...NEW_RACER.defaultQuestionTypes }, jbq: { ...NEW_RACER.defaultJbq } };
    });
    const settings: Settings = { ...this.cfg, players, racerProfiles: profiles, seed: latest.seed };
    saveSettings(settings);
    this.registry.set(REG.settings, settings);
  }

  private openNewPanel(p: PlayerId) {
    services.audio.sfx('menuSelect');
    const taken = racerIds(this.cfg).map((id) => racerName(this.cfg, id));
    const keyboard = this.slots[p].device.type === 'keyboard';
    this.newPanelPlayer = p;
    this.newPanel = new NewRacerPanel(this, hexNum(PLAYER_COLORS[p]), PLAYER_COLORS[p], p + 1, taken, !keyboard, this.cfg.players[p].questionTypes, this.cfg.players[p].jbq);
  }

  private updateNewPanel() {
    const panel = this.newPanel!;
    const res = panel.handle(services.input.get(this.newPanelPlayer));
    if (res === 'none') return;
    this.newPanel = undefined;
    panel.destroy();
    this.inputBlockedUntil = this.time.now + NEXT_GRACE_MS;
    this.syncAssign();
    if (res === 'cancel') { services.audio.sfx('menuMove'); this.cursors[this.newPanelPlayer] = ROW_RACER; return; }
    const p = this.newPanelPlayer;
    const created = createRacer(this.cfg, panel.result!);
    if (!created) { services.audio.sfx('menuMove'); return; }
    const { id, patch } = created;
    Object.assign(this.cfg, patch);
    this.isNew[p] = false;
    familySync.chooseProfile(id);
    this.cfg.players[p] = applyRacerProfile({ ...this.cfg.players[p], profile: id }, p, this.cfg) as SetupPlayer;
    this.persist();
    this.refreshAvailability();
    // Selected, not ready: the player now picks questions / car / buddy and confirms to be Ready.
    this.slots = setReady(this.slots, p, false);
    this.cursors[p] = ROW_CAR; this.chipFocus[p] = 0;
    this.lastChangeAt = this.time.now;
    services.audio.sfx('menuSelect');
    this.refreshAll();
  }
}
