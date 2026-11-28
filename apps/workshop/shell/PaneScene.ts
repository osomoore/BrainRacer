/**
 * One PaneScene per player (keys pane0 / pane1). The main camera viewport is the player's area (whole stage in 1P,
 * a 960x1080 half in 2P); screens draw in pane-local coordinates. Implements PaneContext and the screen stack.
 */
import Phaser from 'phaser';
import type { BuddyKind } from '../../../shared/buddies/catalog';
import { STAGE, WS_RULES, WS_WALLET } from '../config';
import type { Screen, ScreenData, ScreenId } from '../core/runtime';
import { buildRig } from '../art';
import type { ReadingLevel, PlayerSave, WorkshopId } from '../core/types';
import { engine } from '../logic';
import { currencyBadge } from '../ui/CurrencyBadge';
import { Confirm } from '../ui/Confirm';
import { backdropTexture } from '../ui/style';
import { promptLabel, type ShellPaneInput } from '../ui/input';
import type { ShellPaneContext } from './paneContext';
import { waitingScreen } from './placeholderScreen';
import { sandboxSave } from './sandboxes';
import { createScreen } from './screenRegistry';
import { shell } from './shell';
import { resolveActiveProfileId } from '../../../shared/profiles';
import { ActiveChallengeAttribution, activeTimeTracker } from '../logic/activeTime';

interface HistoryEntry { id: string; data: ScreenData }
const selectedChallenges = new Map<string, string>();
const attribution = [new ActiveChallengeAttribution(activeTimeTracker, selectedChallenges),
  new ActiveChallengeAttribution(activeTimeTracker, selectedChallenges)] as const;

export class PaneScene extends Phaser.Scene {
  private count: 1 | 2 = 1;
  private screen?: Screen;
  private worldConfirm?: Confirm;
  private declineWorldConfirm?: () => void;
  private wallet?: ReturnType<typeof currencyBadge>;
  private pending?: { id: string; data: ScreenData; push: boolean };
  private history: HistoryEntry[] = [];
  private buddyUnlocks = new Map<WorkshopId, BuddyKind[]>();
  private current: HistoryEntry = { id: 'profile', data: {} };
  exited = false;
  profileId: string | undefined;
  workshopId: WorkshopId | undefined;
  ctx!: ShellPaneContext;

  constructor(key: string, readonly index: 0 | 1) { super(key); }

  init(d: { count: 1 | 2 }): void {
    this.count = d.count;
    this.profileId = undefined;
    this.workshopId = undefined;
    this.exited = false;
    this.history = [];
    this.buddyUnlocks.clear();
    this.pending = undefined;
  }

  get screenId(): string { return this.current.id; }

  /** Show the invitation over this player's current screen, using only this pane's input. */
  askToGoToWorld(text: string, onAnswer: (yes: boolean) => void): (() => void) | undefined {
    if (!this.profileId || this.exited || this.worldConfirm) return;
    const { input, size, audio } = this.ctx;
    input.poll();
    input.text();
    const finish = (yes: boolean) => {
      cancel();
      onAnswer(yes);
    };
    const confirm = new Confirm(this, {
      cx: size.w / 2, cy: size.h / 2, w: Math.min(size.w - 80, 900),
      text, audio, touch: input.touch, depth: 11_000,
      direct: { yesBadge: promptLabel(input, 'confirm'), noBadge: promptLabel(input, 'back') },
      onYes: () => finish(true),
      onNo: () => finish(false),
    });
    const cancel = () => {
      if (this.worldConfirm !== confirm) return;
      if (confirm.open) confirm.destroy();
      this.worldConfirm = undefined;
      this.declineWorldConfirm = undefined;
    };
    this.worldConfirm = confirm;
    this.declineWorldConfirm = () => finish(false);
    return cancel;
  }

  create(): void {
    const w = this.count === 1 ? STAGE.w : STAGE.w / 2;
    const x = this.count === 1 ? 0 : this.index * w;
    this.cameras.main.setViewport(x, 0, w, STAGE.h);
    this.ctx = this.makeContext(w);
    this.add.image(0, 0, backdropTexture(this, w, STAGE.h)).setOrigin(0).setDepth(-1000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.on(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    const start = this.startScreen();
    this.mount(start.id, start.data);
  }

  /** Normal start is the profile picker; a World hand-off already knows the profile and the workshop. */
  private startScreen(): HistoryEntry {
    const handed = shell.resume[this.index];
    const id = handed ? resolveActiveProfileId(handed.profileId) : undefined;
    if (!handed || !id) return { id: 'profile', data: {} };
    this.profileId = id;
    if (!shell.store.hasPlayer(id)) return { id: 'reading', data: {} };
    if (!handed.workshop) return { id: 'pickWorkshop', data: {} };
    const ws: WorkshopId = handed.workshop === 'dino' ? 'dino' : 'race';
    this.workshopId = ws;
    const save = this.ctx.save();
    this.ctx.commit({ ...save, lastWorkshop: ws, workshops: { ...save.workshops, [ws]: engine.progressOf(save, ws) } });
    return { id: 'room', data: {} };
  }

  private makeContext(w: number): ShellPaneContext {
    const pane = this;
    const input: ShellPaneInput = shell.router.paneInput(this.index, shell.mobile);
    const audio = shell.mixer.forPane(this.index);
    const ctx: ShellPaneContext = {
      scene: this,
      index: this.index,
      size: { w, h: STAGE.h },
      layout: w >= STAGE.w ? 'wide' : 'tall',
      input,
      audio,
      buildRig,
      get profileId() { return pane.profileId; },
      get workshop() { return pane.workshopId; },
      get adminMode() { return shell.adminMode(); },
      get screenId() { return pane.current.id; },
      save(): PlayerSave {
        const id = pane.profileId;
        const real = (id ? shell.store.player(id) : null) ?? engine.newPlayerSave('medium');
        if (!id || !pane.workshopId || !shell.adminMode()) return real;
        return sandboxSave(real, pane.workshopId, shell.sandboxes.get(id, pane.workshopId, real));
      },
      commit(save: PlayerSave): void {
        const id = pane.profileId;
        const activeId = resolveActiveProfileId(id);
        // A retired id can resolve to a merge target; a cached full save from the retired
        // pane must never replace the newly combined target save.
        if (!activeId || activeId !== id) return;
        if (shell.adminMode()) {
          const ws = pane.workshopId;
          if (ws && save.workshops[ws]) shell.sandboxes.set(activeId, ws, save.workshops[ws]!);
        } else {
          shell.store.setPlayer(activeId, save);
        }
        pane.updateWallet();
      },
      queueBuddyUnlock(ws, buddy) {
        const queued = pane.buddyUnlocks.get(ws) ?? [];
        queued.push(buddy);
        pane.buddyUnlocks.set(ws, queued);
      },
      takeBuddyUnlock(ws) {
        const queued = pane.buddyUnlocks.get(ws);
        const buddy = queued?.shift();
        if (!queued?.length) pane.buddyUnlocks.delete(ws);
        return buddy;
      },
      reading(): ReadingLevel { return ctx.save().reading; },
      setProfile(id) {
        const activeId = resolveActiveProfileId(id);
        if (!activeId) return;
        if (activeId !== pane.profileId) {
          // Screens can still own callbacks that write through ctx.commit. Tear them down before
          // changing identity so no late callback can commit the previous player's state.
          pane.unmount();
          pane.workshopId = undefined;
          pane.buddyUnlocks.clear();
        }
        pane.profileId = activeId;
      },
      setWorkshop(id) { pane.workshopId = id; },
      selectBoardChallenge(id) {
        if (!shell.adminMode()) attribution[pane.index].select(pane.profileId, pane.workshopId, id);
        pane.syncActiveTime();
      },
      go(screen: ScreenId, data?: ScreenData) { pane.pending = { id: screen, data: data ?? {}, push: true }; },
      exit() { pane.leave(); },
      otherProfileId() { return shell.count === 2 ? shell.panes[1 - pane.index]?.profileId : undefined; },
      back() {
        const prev = pane.history.pop();
        if (prev) pane.pending = { id: prev.id, data: prev.data, push: false };
        else pane.leave();
      },
    };
    return ctx;
  }

  private leave(): void {
    this.exited = true;
    this.profileId = undefined;
    this.workshopId = undefined;
    const active = shell.panes.slice(0, shell.count);
    if (active.every((p) => p.exited)) { shell.toTitle(); return; }
    this.history = [];
    this.pending = { id: '__waiting', data: {}, push: false };
  }

  /** Re-creates the current screen (after the admin closed: saves / Admin Mode may have changed). */
  refresh(): void {
    if (this.pending) return;
    if (this.exited && this.current.id === '__waiting') return;
    this.pending = { id: this.current.id, data: this.current.data, push: false };
    this.ctx.input.poll();
    this.ctx.input.text();
  }

  /** Called when an admin deletes or merges this pane's active profile. */
  replaceProfile(sourceId: string, targetId?: string, duplicateTarget = false): void {
    if (this.profileId !== sourceId) return;
    const replacement = targetId && !duplicateTarget ? targetId : undefined;
    this.unmount();
    this.profileId = replacement;
    this.workshopId = undefined;
    this.buddyUnlocks.clear();
    this.history = [];
    this.exited = false;
    const next = replacement ? (shell.store.hasPlayer(replacement) ? 'pickWorkshop' : 'reading') : 'profile';
    this.pending = { id: next, data: {}, push: false };
  }

  private mount(id: string, data: ScreenData): void {
    this.unmount();
    this.current = { id, data };
    if (id !== '__waiting') this.exited = false;
    const screen = id === '__waiting' ? waitingScreen() : createScreen(id);
    this.screen = screen;
    this.ctx.input.text(); // drop typed text left over from the previous screen (e.g. the Enter that opened this one)
    screen.create(this.ctx, data);
    this.mountWallet(id);
    this.syncActiveTime();
  }

  private mountWallet(id: string): void {
    const ws = this.workshopId;
    if (!ws) return;
    if (!['room', 'station', 'buddyStation', 'board', 'run', 'results'].includes(id)) return;
    const at = id === 'room' && this.ctx.layout === 'tall'
      ? WS_WALLET.tallRoom
      : this.ctx.input.touch && id === 'room'
      ? WS_WALLET.touchRoom
      : this.ctx.input.touch && id === 'board'
        ? WS_WALLET.touchBoard
        : WS_WALLET[this.ctx.layout === 'wide' ? 'wide' : 'tall'];
    this.wallet = currencyBadge(this, ws, at.x, at.y, '');
    this.wallet.root.setDepth(10_001);
    this.updateWallet();
  }

  private updateWallet(): void {
    if (!this.wallet || !this.workshopId) return;
    const amount = this.ctx.save().workshops[this.workshopId]?.wallet ?? WS_RULES.startWallet;
    this.wallet.label.setText(String(amount));
  }

  private unmount(): void {
    this.declineWorldConfirm?.();
    this.pauseActiveTime();
    this.wallet?.root.destroy();
    this.wallet = undefined;
    const s = this.screen;
    this.screen = undefined;
    try { s?.destroy(); } catch (e) { console.error('screen destroy failed', e); }
  }

  override update(_time: number, delta: number): void {
    shell.router.step(this.game.getFrame());
    if (this.worldConfirm) {
      this.ctx.input.text();
      for (const action of this.ctx.input.poll()) this.worldConfirm?.handle(action);
      return;
    }
    if (this.pending) {
      const p = this.pending;
      this.pending = undefined;
      if (p.push && !(p.id === this.current.id)) this.history.push(this.current);
      this.mount(p.id, p.data);
    }
    this.screen?.update(delta);
  }

  private readonly onVisibilityChange = (): void => this.syncActiveTime();
  private readonly onScenePause = (): void => this.pauseActiveTime();
  private readonly onSceneResume = (): void => this.syncActiveTime();

  private syncActiveTime(): void {
    const ws = this.workshopId;
    const id = this.profileId;
    const progress = id && ws ? this.ctx.save().workshops[ws] : undefined;
    attribution[this.index].sync({ profileId: id, workshop: ws, screen: this.current.id,
      admin: shell.adminMode(), visible: document.visibilityState !== 'hidden', active: this.scene.isActive() && !shell.adminOpen, progress });
  }

  private pauseActiveTime(): void {
    attribution[this.index].pause();
  }

  private teardown(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.events.off(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
    this.unmount();
  }
}
