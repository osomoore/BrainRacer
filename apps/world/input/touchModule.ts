import Phaser from 'phaser';
import { isMobile } from '../../../shared/device';
import { BUTTONS, TOUCH, WORLD } from '../config';
import type { WorldContext, WorldModule } from '../core/runtime';
import { createTouchOverlay, type TouchOverlay } from './touchOverlay';
import { TouchState, touchModeWanted } from './touchMapping';

const KEY = 'WorldTouch';

/** Own scene on top of the world so the heading-up cameras never rotate the overlay. */
class TouchScene extends Phaser.Scene {
  constructor(private readonly state: TouchState, private readonly onReady: (o: TouchOverlay) => void) { super(KEY); }
  create(): void { this.onReady(createTouchOverlay(this, this.state)); }
}

function padConnected(): boolean {
  try { return Array.from(navigator.getGamepads?.() ?? []).some(p => !!p?.connected); } catch { return false; }
}

/** Touch input for a 1-player phone session: writes `player.controls` after the host's mapping (order 50). */
export default class TouchModule implements WorldModule {
  static order = 50;
  private ctx?: WorldContext;
  private state?: TouchState;
  private overlay?: TouchOverlay;
  private padHidden = false;
  private readonly onPad = () => { this.padHidden = padConnected(); this.overlay?.setVisible(!this.padHidden); };

  init(ctx: WorldContext): void {
    if (!touchModeWanted(location.search, isMobile(), ctx.players.length)) return;
    this.ctx = ctx;
    this.state = new TouchState({ width: WORLD.width, ...TOUCH, pause: BUTTONS.pause });
    this.padHidden = padConnected();
    const manager = ctx.scene.scene;
    if (manager.get(KEY)) manager.remove(KEY);
    manager.add(KEY, new TouchScene(this.state, o => { this.overlay = o; o.setVisible(!this.padHidden); }), true);
    window.addEventListener('gamepadconnected', this.onPad);
    window.addEventListener('gamepaddisconnected', this.onPad);
  }

  update(): void {
    const { ctx, state, overlay } = this;
    if (!ctx || !state || !overlay) return;
    if (overlay.consumeTouched() && this.padHidden) { this.padHidden = false; overlay.setVisible(true); }
    const player = ctx.players[0];
    overlay.update(player.busy ? 'cross' : player.special);
    if (this.padHidden) return;
    player.controls = state.frame();
  }

  destroy(): void {
    window.removeEventListener('gamepadconnected', this.onPad);
    window.removeEventListener('gamepaddisconnected', this.onPad);
    this.overlay?.destroy();
    this.overlay = undefined;
    this.state?.cancelAll();
    const manager = this.ctx?.scene.scene;
    if (manager?.get(KEY)) manager.remove(KEY);
    this.ctx = undefined;
  }
}
