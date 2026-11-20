/**
 * Service interfaces for cross-cutting singletons (input, audio). Orchestrator-owned contract.
 * Packages A (input) and D (audio) provide real implementations and register them via
 * `services.input = ...` / `services.audio = ...` in BootScene. Until then the stubs below
 * keep everything runnable (keyboard-less input, silent audio).
 */
import type { ControllerFamily, InputDevice, MusicTrack, PlayerId, PlayerInput, SfxName } from './types';

export interface IInput {
  /** Call exactly once per frame (the active scene does this in update()). */
  poll(): void;
  /** Devices currently connected/usable (keyboard layouts are always present). */
  devices(): InputDevice[];
  /** The device's face-button layout, or the common layout of all connected pads. */
  controllerFamily?(device?: InputDevice): ControllerFamily;
  /** Device (not already in `taken`) that pressed the bottom face button or keyboard confirm. */
  pollJoin(taken: InputDevice[]): InputDevice | null;
  /** Bind a device to a player slot. */
  assign(player: PlayerId, device: InputDevice): void;
  /** Clear all assignments. */
  reset(): void;
  /** Input for an assigned player this frame (zeroed if unassigned/disconnected). */
  get(player: PlayerId): PlayerInput;
  /** Merged input from ALL devices (for menus before players are assigned). */
  any(): PlayerInput;
  isConnected(device: InputDevice): boolean;
  /** Rumble if supported (no-op otherwise). */
  rumble(player: PlayerId, strength: number, ms: number): void;
}

export interface IEngineSound {
  /** speed 0..1 of top speed; boost true while turbo. */
  set(speed: number, boost: boolean): void;
  stop(): void;
}

export interface AudioLoopOptions {
  pan?: number;
  volume?: number;
  sirenTone?: 'bright' | 'soft';
}

export interface IAudio {
  /** Must be called from a user gesture (key/button/click) to satisfy autoplay policy. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  /** pan -1..1 (left/right screen half), volume 0..1 multiplier. */
  sfx(name: SfxName, opts?: { pan?: number; volume?: number; rate?: number }): void;
  /** Start/stop a looping one-shot (e.g. siren). Returns a stop function. */
  loop(name: SfxName, opts?: AudioLoopOptions): () => void;
  engine(player: PlayerId): IEngineSound;
  music(track: MusicTrack | null, crossfadeSec?: number): void;
  setVolumes(music: number, sfx: number): void;
}

export const ZERO_INPUT: PlayerInput = Object.freeze({
  steer: 0, throttle: 0, brake: 0, answer: null, answerDirection: null, transfer: false, resetCar: false,
  confirm: false, back: false, pause: false, navX: 0, navY: 0,
}) as PlayerInput;

class StubInput implements IInput {
  poll() {}
  devices(): InputDevice[] { return []; }
  pollJoin(): InputDevice | null { return null; }
  assign() {}
  reset() {}
  get(): PlayerInput { return ZERO_INPUT; }
  any(): PlayerInput { return ZERO_INPUT; }
  isConnected() { return false; }
  rumble() {}
}

class StubAudio implements IAudio {
  unlocked = false;
  async unlock() { this.unlocked = true; }
  sfx() {}
  loop() { return () => {}; }
  engine(): IEngineSound { return { set() {}, stop() {} }; }
  music() {}
  setVolumes() {}
}

export const services: { input: IInput; audio: IAudio } = {
  input: new StubInput(),
  audio: new StubAudio(),
};
