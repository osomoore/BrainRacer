import Phaser from 'phaser';
import { DEFAULT_SETTINGS, GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, NEW_RACER, PLAYER_COLORS } from '../config/gameConfig';
import { applyRacerProfile, createRacer, playerRacer, racerIds, racerName, racerProfiles, racerSettingsOf, withRacerProfile } from '../core/racerProfiles';
import { services } from '../core/services';
import { selectedLoadout } from '../core/progression';
import { loadAllProgress, racerProgressOf, racerLoadouts, teamPlayableMap, type AllProgress } from '../core/racerProgress';
import { isRaceMap, loadSettings, saveSettings, savedSecondPlayer } from '../core/settings';
import type { CarKind, GuideKind, InputDevice, JbqSettings, PlayerId, PlayerSettings, QuestionTypes, RacerProfileId, Settings } from '../core/types';
import { FaceButtonBadge } from '../ui/menu/FaceButtonBadge';
import { allReady, canAdvance, claimSlot, isLocked, leaveSlot, newJoinPlayer, nextRacer, setReady, waitingFor, type JoinSlot } from '../ui/menu/joinLogic';
import { JoinPanel, ROW_CAR, ROW_GUIDE, ROW_RACER, type PanelView } from '../ui/menu/JoinPanel';
import { MenuButton } from '../ui/menu/MenuButton';
import { ageLabel } from '../ui/menu/newRacerLogic';
import { changeJbq, CHIP_KEYS, jbqLimitNote, jbqPointsLabel, jbqScopeLabel, moveChip, moveRow, ROW_POINTS, ROW_QUESTIONS, ROW_SCOPE, toggleChip, visibleRow } from '../ui/menu/questionPick';
import { NewRacerPanel } from '../ui/menu/NewRacerPanel';
import { bigText, carName, FONT_HEAD, guideName, hexNum, MENU } from '../ui/menu/style';
import { isMobile } from '../../shared/device';
import { REG, SCENE } from './keys';

/** Stand-in id for "New Profile": matches no shared profile, so no saved progress: only the starter cars/guides and City. */
const NEW_PROFILE_ID = 'new-profile' as RacerProfileId;
const NEXT_GRACE_MS = 500;
type SetupPlayer = PlayerSettings & { questionTypes: QuestionTypes; jbq: JbqSettings };

/** Data passed when entering: `device` = fresh start from Title (that device claims panel 1); otherwise the registry players are restored. */
export interface JoinSceneData { device?: InputDevice; keepReady?: boolean }

/**
 * Join screen: four panels. A device claims the next free panel with its confirm button, then each player picks
 * racer / car / buddy and presses confirm to be Ready (which locks the panel). Only Player 1 can continue, once everyone is ready.
 */
export class SetupScene extends Phaser.Scene {
  private cfg!: Settings & { players: SetupPlayer[] };
  private slots: JoinSlot[] = [];
  private cursors: number[] = [];
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
  private newPanel?: NewRacerPanel;
  private newPanelPlayer: PlayerId = 0;
  /** Phone/tablet: one player, one centered card, tappable NEXT. */
  private mobile = false;
  private maxPlayers = MAX_PLAYERS;

  constructor() { super(SCENE.setup); }

  create(data: JoinSceneData = {}) {
    this.mobile = isMobile();
    this.maxPlayers = this.mobile ? 1 : MAX_PLAYERS;
    this.leaving = false; this.slots = []; this.cursors = []; this.chipFocus = []; this.isNew = []; this.panels = []; this.newPanel = undefined;
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
        this.cursors.push(ROW_RACER); this.chipFocus.push(0); this.isNew.push(false);
        this.cfg.players.push(p as SetupPlayer);
      });
      this.slots = this.slots.map((s) => ({ ...s, ready: data.keepReady === true && !this.mobile }));
      this.applyRacers();
      this.refreshAvailability();
    }
    this.syncAssign();
    this.refreshAll();
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshAdvanced, this);
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
    const p = newJoinPlayer(i, device, prev, savedPlayers[0]?.car, ids, taken, ids[i]);
    this.slots = claimSlot(this.slots, device);
    this.cursors.push(ROW_RACER);
    this.chipFocus.push(0);
    // No free profile (a fresh device, or all taken): the player starts on "New Profile" and makes their racer.
    this.isNew.push(p.profile === undefined);
    this.cfg.players.push((p.profile === undefined ? { ...p, questionTypes: { ...NEW_RACER.defaultQuestionTypes }, jbq: { ...NEW_RACER.defaultJbq } } : applyRacerProfile(p, i, this.cfg)) as SetupPlayer);
    this.refreshAvailability();
  }

  private removePlayer(i: number) {
    this.slots = leaveSlot(this.slots, i);
    this.cursors.splice(i, 1); this.chipFocus.splice(i, 1); this.isNew.splice(i, 1); this.cfg.players.splice(i, 1);
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

  private loadout(player: number): { car: CarKind; guide: GuideKind } {
    return selectedLoadout(this.cfg.players[player], player, this.cfg.developerMode === true, this.available[player]);
  }

  // ───────────────────────── view ─────────────────────────
  /** One short line under the racer name: age band and level (race length is the Admin Race time row; the card is too narrow for it). */
  private hintText(p: SetupPlayer, slot: number): string {
    if (this.isNew[slot]) return 'Make your racer!';
    return `Age ${ageLabel(p.difficulty)}`;
  }

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
      const view: PanelView = {
        device: s.device,
        family: s.device.type === 'gamepad' ? services.input.controllerFamily?.(s.device) : undefined,
        racer: this.isNew[i] ? 'New Profile' : racerName(c, playerRacer(p, i, c)),
        hint: this.hintText(p, i),
        car: carName(car), guide: guideName(guide), carKind: car, guideKind: guide,
        chipsOn: CHIP_KEYS.map((k) => p.questionTypes[k]), chipFocus: this.chipFocus[i],
        jbqPoints: jbqPointsLabel(p.jbq.points), jbqScope: jbqScopeLabel(p.jbq.points, p.jbq.scope), jbqBasics: p.jbq.points === 'basics',
        jbqLimit: jbqLimitNote(p.jbq.points, this.slots.length),
        cursor: visibleRow(this.cursors[i], p.questionTypes.jbq, p.jbq.points === 'basics'), ready: s.ready,
      };
      panel.render(view);
    });
    this.refreshBottom();
  }

  private refreshBottom() {
    const ready = allReady(this.slots);
    const first = this.slots[0]?.device;
    const showNext = ready || (this.mobile && this.slots.length > 0);
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
    if (this.leaving) return;
    if (this.newPanel) { this.updateNewPanel(); return; }
    const hadPlayers = this.slots.length > 0;
    for (let p = 0; p < this.slots.length; p++) {
      if (this.handle(p as PlayerId, time)) return;
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
  private handle(p: PlayerId, time: number): boolean {
    const inp = services.input.get(p);
    const locked = isLocked(this.slots, p);
    if (locked) {
      // Ready panels ignore the D-pad. Only P1 may continue; everyone else's confirm does nothing.
      if (inp.back) { this.slots = setReady(this.slots, p, false); services.audio.sfx('menuMove'); this.refreshAll(); return false; }
      const comboHeld = inp.brake > 0.5 && inp.throttle > 0.5;
      if ((inp.confirm || (inp.pause && !comboHeld)) && canAdvance(this.slots, p) && time - this.lastChangeAt >= NEXT_GRACE_MS) {
        this.goNext();
        return true;
      }
      return false;
    }
    const cur = this.cursors[p];
    if (inp.navY) {
      const pq = this.cfg.players[p].questionTypes, basics = this.cfg.players[p].jbq.points === 'basics';
      const n = moveRow(visibleRow(cur, pq.jbq, basics), inp.navY > 0 ? 1 : -1, pq.jbq, basics);
      if (n !== cur) { this.cursors[p] = n; services.audio.sfx('menuMove'); this.refreshAll(); }
    }
    if (inp.navX) this.change(p, this.cursors[p], inp.navX > 0 ? 1 : -1);
    if (inp.confirm) {
      if (this.cursors[p] === ROW_QUESTIONS) { this.change(p, ROW_QUESTIONS, 0); return false; } // A toggles the focused chip; Ready is on the other rows
      if (this.isNew[p]) { this.openNewPanel(p); return true; }
      this.slots = setReady(this.slots, p, true);
      this.lastChangeAt = time;
      services.audio.sfx('menuSelect');
      this.refreshAll();
      return false;
    }
    if (inp.back) {
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
    if (this.leaving || this.newPanel || p >= this.slots.length || isLocked(this.slots, p)) return;
    this.cursors[p] = row;
    if (dir === 0 && row === ROW_RACER && this.isNew[p]) { this.openNewPanel(p); return; }
    this.change(p, row, dir || 1);
  }

  /** Tap on a Math / Reading / JBQ chip: focus it and flip it. */
  private tapChip(p: PlayerId, chip: number) {
    if (this.leaving || this.newPanel || p >= this.slots.length || isLocked(this.slots, p)) return;
    this.cursors[p] = ROW_QUESTIONS;
    this.chipFocus[p] = chip;
    this.change(p, ROW_QUESTIONS, 0);
  }

  /** Mobile NEXT: a new profile opens the name flow first, otherwise the card counts as Ready and we go on. */
  private mobileNext() {
    if (this.leaving || this.newPanel || !this.slots.length) return;
    if (this.isNew[0]) { this.openNewPanel(0); return; }
    this.slots = setReady(this.slots, 0, true);
    this.goNext();
  }

  /** `dir` 0 on the Questions row = toggle the focused chip; -1/+1 there moves the chip focus. */
  private change(p: number, row: number, dir: 1 | -1 | 0) {
    const c = this.cfg;
    const ps = c.players[p];
    const cycle = <T,>(list: readonly T[], v: T) => list[Phaser.Math.Wrap(list.indexOf(v) + (dir || 1), 0, list.length)];
    const panel = this.panels[p];
    let target;
    if (row === ROW_QUESTIONS) {
      if (dir === 0) {
        const next = toggleChip(ps.questionTypes, this.chipFocus[p]);
        if (next === ps.questionTypes) { services.audio.sfx('menuMove'); return; } // the last chip on stays on
        ps.questionTypes = next;
        if (!next.jbq) this.cursors[p] = ROW_QUESTIONS;
        this.saveQuestions(p);
      } else this.chipFocus[p] = moveChip(this.chipFocus[p], dir);
      services.audio.sfx('menuMove');
      this.refreshAll();
      return;
    } else if (row === ROW_POINTS || row === ROW_SCOPE) {
      if (dir === 0) return;
      ps.jbq = changeJbq(ps.jbq, row, dir);
      this.saveQuestions(p);
      target = row === ROW_POINTS ? panel.pointsRow : panel.scopeRow;
    } else if (row === ROW_RACER) {
      const takenByOthers = c.players
        .map((o, k) => (k === p || this.isNew[k] ? undefined : playerRacer(o, k, c)))
        .filter(Boolean) as RacerProfileId[];
      const next = nextRacer(racerIds(c), takenByOthers, racerIds(c).length < NEW_RACER.maxCustomRacers, this.isNew[p] ? 'new' : playerRacer(ps, p, c) ?? 'new', dir || 1);
      if (next === 'new') this.isNew[p] = true;
      else { this.isNew[p] = false; c.players[p] = applyRacerProfile({ ...ps, profile: next }, p, c) as SetupPlayer; }
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

  /** Saves a player's question choices to their racer profile right away (a New Profile player keeps them in the session until the profile is made). */
  private saveQuestions(p: number) {
    if (this.isNew[p]) return;
    const ps = this.cfg.players[p];
    const id = playerRacer(ps, p, this.cfg);
    if (!id) return;
    Object.assign(this.cfg, withRacerProfile(this.cfg, id, { ...racerSettingsOf(this.cfg, id), questionTypes: { ...ps.questionTypes }, jbq: { ...ps.jbq } }));
    this.persist();
  }

  private goNext() {
    this.leaving = true;
    services.audio.sfx('menuSelect');
    this.applyRacers();
    this.persist();
    this.syncAssign();
    this.scene.start(SCENE.track);
  }

  private persist() {
    const settings: Settings = { ...this.cfg, seed: loadSettings().seed };
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
    if (res === 'cancel') { services.audio.sfx('menuMove'); return; }
    const p = this.newPanelPlayer;
    const created = createRacer(this.cfg, panel.result!);
    if (!created) { services.audio.sfx('menuMove'); return; }
    const { id, patch } = created;
    Object.assign(this.cfg, patch);
    this.isNew[p] = false;
    this.cfg.players[p] = applyRacerProfile({ ...this.cfg.players[p], profile: id }, p, this.cfg) as SetupPlayer;
    this.persist();
    this.refreshAvailability();
    this.slots = setReady(this.slots, p, true);
    this.lastChangeAt = this.time.now;
    this.refreshAll();
  }
}
