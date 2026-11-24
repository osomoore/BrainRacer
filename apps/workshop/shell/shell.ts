/**
 * The shell singleton: shared services every shell scene needs. Populated once by `createShell` (game.ts) before
 * any scene runs, so scenes can import `shell` safely.
 */
import type Phaser from 'phaser';
import type { DeviceId } from '../../../shared/input/deviceInput';
import type { WorkshopAudio } from '../core/runtime';
import type { AudioMixer } from './audioMixer';
import type { InputRouter } from './inputRouter';
import type { PaneScene } from './PaneScene';
import type { AdminSandboxes } from './sandboxes';
import type { SaveStore } from './store';

export interface Shell {
  game: Phaser.Game;
  store: SaveStore;
  router: InputRouter;
  sandboxes: AdminSandboxes;
  mixer: AudioMixer;
  baseAudio: WorkshopAudio;
  /** Builds the real audio once BootScene has preloaded the files (before that `baseAudio` is silent). */
  initAudio(): void;
  mobile: boolean;
  /** 0 = title / join screen, 1 or 2 = panes running. */
  count: 0 | 1 | 2;
  /** Game frame in which the title was last requested (its events belong to the pane that closed). */
  titleFrame: number;
  panes: PaneScene[];
  adminOpen: boolean;
  adminMode(): boolean;
  setAdminMode(on: boolean): void;
  startPanes(devices: readonly DeviceId[]): void;
  toTitle(fromBoot?: boolean): void;
  /** Opens the grown-up admin (gate = ask the multiplication question first: mobile gear). */
  openAdmin(gate: boolean): void;
  closeAdmin(): void;
}

export const shell = {} as Shell;
