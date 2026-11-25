/** Creates the workshop Phaser game and wires the shell singleton, scenes and the `window.__ws` test hook. */
import Phaser from 'phaser';
import { isMobile } from '../../../shared/device';
import type { WorkshopAudio } from '../core/runtime';
import type { DeviceId } from '../../../shared/input/deviceInput';
import { createWorkshopAudio } from '../audio';
import { STAGE, WS_RUN } from '../config';
import { engine } from '../logic';
import { AdminScene } from './admin/AdminScene';
import { AudioMixer } from './audioMixer';
import { BootScene } from './BootScene';
import { InputRouter } from './inputRouter';
import { OverlayScene } from './OverlayScene';
import { PaneScene } from './PaneScene';
import { AdminSandboxes } from './sandboxes';
import { screenIds } from './screenRegistry';
import { shell } from './shell';
import { SaveStore } from './store';
import { TitleScene } from './TitleScene';
import { subscribeProfileReplacements } from '../../../shared/sync/changes';

const MAIN_SCENES = ['title', 'pane0', 'pane1'] as const;

export function createWorkshopGame(parent: HTMLElement): Phaser.Game {
  const panes = [new PaneScene('pane0', 0), new PaneScene('pane1', 1)];
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: STAGE.w, height: STAGE.h, backgroundColor: '#3fb7ff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, fixedStep: true, fps: WS_RUN.physicsHz } },
    input: { gamepad: false },
    scene: [new BootScene(), new TitleScene(), ...panes, new OverlayScene(), new AdminScene()],
  });

  const store = new SaveStore();
  const sandboxes = new AdminSandboxes();
  const router = new InputRouter();
  // The real audio needs the files BootScene preloads, so it is built after the preload (`shell.initAudio`);
  // until then (and if loading fails) this forwarder is silent.
  let realAudio: WorkshopAudio | null = null;
  const baseAudio: WorkshopAudio = {
    music: (t) => realAudio?.music(t),
    sfx: (n, o) => realAudio?.sfx(n, o),
    sting: (n) => realAudio?.sting(n),
    loop: (n, o) => realAudio?.loop(n, o) ?? (() => {}),
  };
  let adminFlag = store.device().adminMode;
  let paused: string[] = [];

  Object.assign(shell, {
    game, store, router, baseAudio, panes,
    sandboxes,
    mixer: new AudioMixer(baseAudio),
    initAudio() {
      if (realAudio) return;
      realAudio = createWorkshopAudio(game);
    },
    mobile: isMobile(),
    count: 0,
    titleFrame: -1,
    adminOpen: false,
    adminMode: () => adminFlag,
    setAdminMode(on: boolean) {
      adminFlag = on;
      store.setDevice({ version: 1, adminMode: on });
      shell.sandboxes.clear();
    },
    startPanes(devices: readonly DeviceId[]) {
      shell.count = devices.length >= 2 ? 2 : 1;
      router.devices = devices.slice(0, shell.count);
      router.clearQueues();
      router.panesLive = true;
      shell.mixer.count = shell.count;
      shell.mixer.clear();
      game.scene.stop('title');
      game.scene.start('pane0', { count: shell.count });
      if (shell.count === 2) game.scene.start('pane1', { count: 2 });
    },
    toTitle(fromBoot = false) {
      shell.titleFrame = fromBoot ? -1 : game.getFrame();
      shell.count = 0;
      router.devices = [];
      router.panesLive = false;
      router.clearQueues();
      shell.mixer.clear();
      game.scene.stop('pane0');
      game.scene.stop('pane1');
      game.scene.start('title');
      if (!game.scene.isActive('overlay')) game.scene.start('overlay');
    },
    openAdmin(gate: boolean) {
      if (shell.adminOpen) return;
      shell.adminOpen = true;
      router.panesLive = false;
      paused = MAIN_SCENES.filter((k) => game.scene.isActive(k));
      paused.forEach((k) => game.scene.pause(k));
      game.scene.start('admin', { gate });
    },
    closeAdmin() {
      if (!shell.adminOpen) return;
      shell.adminOpen = false;
      game.scene.stop('admin');
      paused.forEach((k) => game.scene.resume(k));
      paused = [];
      router.clearQueues();
      router.panesLive = shell.count > 0;
      if (shell.count > 0) panes.slice(0, shell.count).forEach((p) => p.refresh());
    },
  });
  router.onAdmin = () => {
    const panels = window as Window & { __familySyncDialogOpen?: boolean; __profilesPanelOpen?: boolean };
    if (panels.__familySyncDialogOpen || panels.__profilesPanelOpen) return;
    if (shell.adminOpen) shell.closeAdmin();
    else shell.openAdmin(false);
  };

  const unsubscribeProfileReplacements = subscribeProfileReplacements((sourceId, targetId) => {
    sandboxes.removeProfile(sourceId);
    const sourcePanes = panes.filter((pane) => pane.profileId === sourceId);
    for (const pane of sourcePanes) {
      const duplicateTarget = targetId !== undefined && panes.some((other) => other !== pane && other.profileId === targetId);
      pane.replaceProfile(sourceId, targetId, duplicateTarget);
    }
    panes.slice(0, shell.count).forEach((pane) => pane.refresh());
  });
  game.events.once(Phaser.Core.Events.DESTROY, unsubscribeProfileReplacements);

  // Mobile / browser audio unlock on the first gesture (Phaser also unlocks its own context on touch).
  const unlock = () => {
    try {
      const c = (game.sound as unknown as { context?: AudioContext }).context;
      if (c && c.state === 'suspended') void c.resume();
    } catch { /* ignore */ }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  (window as unknown as { __ws: unknown }).__ws = {
    game, shell, engine, store, router,
    panes,
    contexts: () => panes.slice(0, shell.count).map((p) => p.ctx),
    screens: () => panes.slice(0, shell.count).map((p) => p.screenId),
    screenIds,
    state: () => ({ scene: shell.count > 0 ? 'panes' : game.scene.isActive('title') ? 'title' : 'boot', count: shell.count, screens: panes.slice(0, shell.count).map((p) => p.screenId), adminOpen: shell.adminOpen, adminMode: adminFlag }),
    device: () => store.device(),
  };
  return game;
}
