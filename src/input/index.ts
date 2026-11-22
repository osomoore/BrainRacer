import { resolvePadMap } from './padMaps';
import { identifyController } from './buttonPrompts';
import { bus } from '../core/events';
import type { ControllerFamily, InputDevice, PlayerId, PlayerInput } from '../core/types';
import { ZERO_INPUT, type IInput } from '../core/services';
import { HANDLED_CODES, mapKeyboard, type KeyLayout } from './keyboardMap';
import { getTuning } from '../config/deviceTuning';
import { gasThrottle, mapGamepad, mergeInputs, newRepeatState, type PadSnapshot, type RepeatState } from './mapping';
import { DebugOverlay, formatDebug } from './overlay';

const KB_LAYOUTS: KeyLayout[] = ['left', 'right'];
const devKey = (d: InputDevice) => (d.type === 'gamepad' ? `pad${d.index}` : `kb-${d.layout}`);
const sameDevice = (a: InputDevice, b: InputDevice) => devKey(a) === devKey(b);

interface HapticPad {
  vibrationActuator?: {
    playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  } | null;
}

class InputManager implements IInput {
  private held = new Set<string>();
  private tapped = new Set<string>();
  private prevKeys = new Set<string>();
  private kbRepeat: Record<KeyLayout, RepeatState> = { left: newRepeatState(), right: newRepeatState() };
  private padRepeat = new Map<number, RepeatState>();
  private prevPads = new Map<number, PadSnapshot>();
  private pads = new Map<number, PadSnapshot>();
  private connected = new Set<number>();
  private results = new Map<string, PlayerInput>();
  private assigned: (InputDevice | null)[] = [null, null, null, null];
  private overlay = new DebugOverlay();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onPadConnected);
    window.addEventListener('gamepaddisconnected', this.onPadDisconnected);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F2' && !e.repeat) this.overlay.toggle();
    if (HANDLED_CODES.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    this.held.add(e.code);
    this.tapped.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.held.delete(e.code); };
  private onBlur = () => { this.held.clear(); this.tapped.clear(); };

  private addPad(index: number) {
    if (this.connected.has(index)) return;
    this.connected.add(index);
    bus.emit('input:connected', { device: { type: 'gamepad', index } });
  }
  private removePad(index: number) {
    if (!this.connected.delete(index)) return;
    this.pads.delete(index);
    this.prevPads.delete(index);
    this.padRepeat.delete(index);
    bus.emit('input:disconnected', { device: { type: 'gamepad', index } });
  }
  private onPadConnected = (e: GamepadEvent) => this.addPad(e.gamepad.index);
  private onPadDisconnected = (e: GamepadEvent) => this.removePad(e.gamepad.index);

  private readPads(): Map<number, PadSnapshot> {
    const out = new Map<number, PadSnapshot>();
    let list: (Gamepad | null)[] = [];
    try { list = Array.from(navigator.getGamepads?.() ?? []); } catch { /* ignore */ }
    for (const g of list) {
      if (!g || !g.connected) continue;
      out.set(g.index, {
        id: g.id, mapping: g.mapping,
        axes: Array.from(g.axes),
        buttons: g.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
      });
    }
    return out;
  }

  poll(): void {
    const now = performance.now() / 1000;
    this.results.clear();

    const effective = new Set([...this.held, ...this.tapped]);
    for (const layout of KB_LAYOUTS) {
      this.results.set(`kb-${layout}`, mapKeyboard(layout, effective, this.prevKeys, this.kbRepeat[layout], now));
    }
    this.prevKeys = new Set(this.held); // a tap shorter than a frame fires once, then is gone
    this.tapped.clear();

    // Reconcile hot-plug here too, in case events were missed.
    const snaps = this.readPads();
    for (const i of snaps.keys()) this.addPad(i);
    for (const i of [...this.connected]) if (!snaps.has(i)) this.removePad(i);
    this.pads = snaps;
    for (const [i, snap] of snaps) {
      let rep = this.padRepeat.get(i);
      if (!rep) this.padRepeat.set(i, (rep = newRepeatState()));
      this.results.set(`pad${i}`, mapGamepad(snap, this.prevPads.get(i) ?? null, rep, now));
    }
    this.prevPads = snaps;

    this.overlay.update(() =>
      formatDebug(this.pads, ([0, 1, 2, 3] as PlayerId[]).map((p) => (this.assigned[p] ? this.get(p) : null))));
  }

  devices(): InputDevice[] {
    const pads: InputDevice[] = [...this.connected].sort((a, b) => a - b).map((index) => ({ type: 'gamepad', index }));
    return [...pads, ...KB_LAYOUTS.map((layout): InputDevice => ({ type: 'keyboard', layout }))];
  }

  isConnected(device: InputDevice): boolean {
    return device.type === 'keyboard' || this.connected.has(device.index);
  }

  controllerFamily(device?: InputDevice): ControllerFamily {
    if (device?.type === 'keyboard') return 'other';
    if (device) return identifyController(this.pads.get(device.index)?.id ?? '');
    let family: ControllerFamily | undefined;
    for (const pad of this.pads.values()) {
      const next = identifyController(pad.id);
      if (next === 'other' || (family !== undefined && family !== next)) return 'other';
      family = next;
    }
    return family ?? 'other';
  }

  pollJoin(taken: InputDevice[]): InputDevice | null {
    for (const d of this.devices()) {
      if (taken.some((t) => sameDevice(t, d))) continue;
      if (this.results.get(devKey(d))?.confirm) return d;
    }
    return null;
  }

  assign(player: PlayerId, device: InputDevice): void { this.assigned[player] = device; }
  reset(): void { this.assigned = [null, null, null, null]; }

  get(player: PlayerId): PlayerInput {
    const d = this.assigned[player];
    if (!d || !this.isConnected(d)) return ZERO_INPUT;
    const res = this.results.get(devKey(d)) ?? ZERO_INPUT;
    // Gas mode applies to gamepads only, and only here (races); any() stays raw so the settings combo and menus work.
    const mode = getTuning().gas[player];
    const snap = d.type === 'gamepad' ? this.pads.get(d.index) : undefined;
    if (!snap || mode === 'a') return res;
    return { ...res, throttle: gasThrottle(snap, resolvePadMap(snap.id, snap.mapping), mode) };
  }

  any(): PlayerInput { return mergeInputs([...this.results.values()]); }

  rumble(player: PlayerId, strength: number, ms: number): void {
    try {
      const d = this.assigned[player];
      if (!d || d.type !== 'gamepad') return;
      const pad = navigator.getGamepads?.()[d.index] as (Gamepad & HapticPad) | null | undefined;
      const mag = Math.max(0, Math.min(1, strength));
      const p = pad?.vibrationActuator?.playEffect?.('dual-rumble', {
        startDelay: 0, duration: ms, strongMagnitude: mag, weakMagnitude: mag,
      });
      p?.catch?.(() => {});
    } catch { /* rumble is best-effort */ }
  }
}

export function createInput(): IInput {
  return new InputManager();
}
