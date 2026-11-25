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
import { backdropTexture } from '../ui/style';
import type { ShellPaneInput } from '../ui/input';
import type { ShellPaneContext } from './paneContext';
import { waitingScreen } from './placeholderScreen';
import { sandboxSave } from './sandboxes';
import { createScreen } from './screenRegistry';
import { shell } from './shell';

interface HistoryEntry { id: string; data: ScreenData }

export class PaneScene extends Phaser.Scene {
  private count: 1 | 2 = 1;
  private screen?: Screen;
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

  create(): void {
    const w = this.count === 1 ? STAGE.w : STAGE.w / 2;
    const x = this.count === 1 ? 0 : this.index * w;
    this.cameras.main.setViewport(x, 0, w, STAGE.h);
    this.ctx = this.makeContext(w);
    this.add.image(0, 0, backdropTexture(this, w, STAGE.h)).setOrigin(0).setDepth(-1000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.mount('profile', {});
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
        if (!id) return;
        if (shell.adminMode()) {
          const ws = pane.workshopId;
          if (ws && save.workshops[ws]) shell.sandboxes.set(id, ws, save.workshops[ws]!);
        } else {
          shell.store.setPlayer(id, save);
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
        if (id !== pane.profileId) {
          pane.workshopId = undefined;
          pane.buddyUnlocks.clear();
        }
        pane.profileId = id;
      },
      setWorkshop(id) { pane.workshopId = id; },
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
  }

  private mountWallet(id: string): void {
    const ws = this.workshopId;
    if (!ws) return;
    if (!['room', 'station', 'buddyStation', 'board', 'run', 'results'].includes(id)) return;
    const at = WS_WALLET[this.ctx.layout === 'wide' ? 'wide' : 'tall'];
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
    this.wallet?.root.destroy();
    this.wallet = undefined;
    const s = this.screen;
    this.screen = undefined;
    try { s?.destroy(); } catch (e) { console.error('screen destroy failed', e); }
  }

  override update(_time: number, delta: number): void {
    shell.router.step(this.game.getFrame());
    if (this.pending) {
      const p = this.pending;
      this.pending = undefined;
      if (p.push && !(p.id === this.current.id)) this.history.push(this.current);
      this.mount(p.id, p.data);
    }
    this.screen?.update(delta);
  }

  private teardown(): void {
    this.unmount();
  }
}
