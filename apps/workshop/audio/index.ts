/**
 * STUB from the orchestrator (silent). The audio package REPLACES this file; keep these two exports.
 * `preloadWorkshopAudio` runs in the boot scene's preload(); `createWorkshopAudio` once after boot.
 */
import type Phaser from 'phaser';
import type { WorkshopAudio } from '../core/runtime';

export function preloadWorkshopAudio(_scene: Phaser.Scene): void {}

export function createWorkshopAudio(_game: Phaser.Game): WorkshopAudio {
  return { music() {}, sfx() {}, sting() {}, loop: () => () => {} };
}
