import { deviceKey, KB_LAYOUT_KEYS, type DeviceAction, type DeviceId, type DeviceInput } from '../../../shared/input/deviceInput';
import { resolvePadMap } from '../../../shared/input/padMaps';
import { WORLD_HOST } from '../config';
import type { PlayerControls } from '../core/runtime';

const extraKeys = {
  1: { KeyE: 'x', KeyX: 'x', KeyR: 'y' },
  2: { Numpad1: 'x', Numpad2: 'y' },
} as const;

export function idleControls(): PlayerControls {
  return { x: 0, y: 0, throttle: 0, brake: 0, pressed: { a: false, b: false, x: false, y: false, menu: false } };
}

/** Continuous driving input supplements the shell's shared edge-triggered menu reader. */
export class WorldControls {
  private readonly held = new Set<string>();
  private readonly edges = new Set<string>();
  private padButtons = new Map<number, { x: boolean; y: boolean }>();
  private readonly keyboardCodes: Set<string>;

  constructor(private readonly input: DeviceInput, devices: readonly DeviceId[]) {
    this.keyboardCodes = new Set(devices.flatMap(device => device.kind === 'kb'
      ? [...Object.keys(KB_LAYOUT_KEYS[device.layout]), ...Object.keys(extraKeys[device.layout])]
      : []));
    input.poll();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearKeys);
  }

  sample(devices: readonly DeviceId[]): PlayerControls[] {
    const actions = new Map<string, Set<DeviceAction>>();
    for (const event of this.input.poll()) {
      if (event.type !== 'action') continue;
      const key = deviceKey(event.device);
      const presses = actions.get(key) ?? new Set<DeviceAction>();
      presses.add(event.action);
      actions.set(key, presses);
    }
    let pads: (Gamepad | null)[] = [];
    if (devices.some(device => device.kind === 'pad')) {
      try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* pads unavailable */ }
    }
    const nextPadButtons = new Map<number, { x: boolean; y: boolean }>();
    const result = devices.map(device => {
      const controls = idleControls();
      const pressed = actions.get(deviceKey(device));
      controls.pressed.a = !!pressed?.has('confirm');
      controls.pressed.b = !!pressed?.has('back');
      controls.pressed.menu = !!pressed?.has('menu');
      if (device.kind === 'kb') {
        for (const [code, action] of Object.entries(KB_LAYOUT_KEYS[device.layout])) {
          if (!this.held.has(code)) continue;
          if (action === 'left') controls.x--;
          if (action === 'right') controls.x++;
          if (action === 'up') controls.y--;
          if (action === 'down') controls.y++;
        }
        for (const [code, button] of Object.entries(extraKeys[device.layout])) {
          controls.pressed[button] ||= this.edges.has(code);
        }
        controls.throttle = -controls.y;
      } else if (device.kind === 'pad') {
        const pad = pads.find(candidate => candidate?.connected && candidate.index === device.index);
        if (pad) {
          const map = resolvePadMap(pad.id, pad.mapping);
          const button = (index: number) => pad.buttons[index]?.pressed ? 1 : 0;
          const axis = (index: number) => {
            const value = pad.axes[index] ?? 0;
            const deadZone = WORLD_HOST.stickDeadZone;
            return Math.sign(value) * Math.max(0, (Math.abs(value) - deadZone) / (1 - deadZone));
          };
          controls.x = button(map.dRight) - button(map.dLeft) || axis(map.axisX);
          controls.y = button(map.dDown) - button(map.dUp) || axis(map.axisY);
          controls.throttle = pad.buttons[map.rt]?.value || -controls.y;
          controls.brake = pad.buttons[map.lt]?.value || 0;
          const buttons = { x: !!button(map.x), y: !!button(map.y) };
          const previous = this.padButtons.get(device.index);
          controls.pressed.x = !!previous && buttons.x && !previous.x;
          controls.pressed.y = !!previous && buttons.y && !previous.y;
          nextPadButtons.set(device.index, buttons);
        }
      }
      return controls;
    });
    this.padButtons = nextPadButtons;
    this.edges.clear();
    return result;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearKeys);
  }

  private keyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || !this.keyboardCodes.has(event.code)) return;
    if (!event.repeat) this.edges.add(event.code);
    this.held.add(event.code);
  };

  private keyUp = (event: KeyboardEvent): void => { this.held.delete(event.code); };
  private clearKeys = (): void => { this.held.clear(); this.edges.clear(); };
}
