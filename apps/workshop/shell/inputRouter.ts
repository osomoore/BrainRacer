/**
 * Routes device events to the title scene (raw events), the admin scene (raw events) and the panes (per-pane queues).
 * Every scene calls `step(frame)` at the start of its update; only the first call per game frame polls the devices.
 *
 * Pane assignment: 1 pane = every device is accepted (a grown-up may help on the keyboard); 2 panes = strictly by the
 * device each player joined with.
 */
import { createDeviceInput, deviceKey, sameDevice, type DeviceAction, type DeviceEvent, type DeviceId, type DeviceInput } from '../../../shared/input/deviceInput';
import type { PaneAction } from '../core/runtime';
import type { ShellPaneInput } from '../ui/input';

interface Queue { actions: PaneAction[]; text: string[] }

export class InputRouter {
  readonly hub: DeviceInput;
  /** Events of the current frame (title / admin read these). */
  raw: DeviceEvent[] = [];
  /** Devices of the joined players, by pane index (empty on the title screen). */
  devices: DeviceId[] = [];
  /** Pane queues are only filled while panes are running (not paused by admin, not on the title). */
  panesLive = false;
  onAdmin?: () => void;
  private frame = -1;
  private readonly queues: Queue[] = [{ actions: [], text: [] }, { actions: [], text: [] }];

  constructor(hub: DeviceInput = createDeviceInput()) { this.hub = hub; }

  step(frame: number): void {
    if (frame === this.frame) return;
    this.frame = frame;
    this.raw = this.hub.poll();
    for (const ev of this.raw) {
      if (ev.type === 'admin') { this.onAdmin?.(); continue; }
      if (!this.panesLive) continue;
      const count = this.devices.length;
      for (let i = 0; i < count; i++) {
        if (count > 1 && !sameDevice(this.devices[i], ev.device)) continue;
        if (ev.type === 'action') this.queues[i].actions.push(ev.action);
        else this.queues[i].text.push(ev.text);
      }
    }
  }

  clearQueues(): void {
    for (const q of this.queues) { q.actions.length = 0; q.text.length = 0; }
  }

  /** All actions of the frame from any device (admin screen). */
  rawActions(): DeviceAction[] {
    return this.raw.flatMap((e) => (e.type === 'action' ? [e.action] : []));
  }

  paneInput(index: 0 | 1, touch: boolean): ShellPaneInput {
    const q = this.queues[index];
    const router = this;
    return {
      poll: () => q.actions.splice(0),
      text: () => q.text.splice(0),
      get touch() { return touch; },
      get prompts() {
        if (touch) return 'none' as const;
        const d = router.devices[index];
        return d && d.kind === 'pad' ? ('pad' as const) : ('keys' as const);
      },
      get device() { return touch ? null : (router.devices[index] ?? null); },
    };
  }

  deviceName(d: DeviceId): string {
    if (d.kind === 'pad') return `Controller ${d.index + 1}`;
    if (d.kind === 'kb') return d.layout === 1 ? 'Keyboard: W A S D' : 'Keyboard: arrows';
    return 'Touch';
  }

  describe(d: DeviceId): string { return `${deviceKey(d)} ${this.deviceName(d)}`; }

  dispose(): void { this.hub.dispose(); }
}
