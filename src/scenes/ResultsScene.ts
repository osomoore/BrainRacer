import Phaser from 'phaser';
import type { RoundResults } from '../core/types';
import { REG, SCENE } from './keys';

/** Placeholder — replaced by package L. */
export class ResultsScene extends Phaser.Scene {
  constructor() { super(SCENE.results); }
  create() {
    const r = this.registry.get(REG.results) as RoundResults | undefined;
    this.add.text(this.scale.width / 2, this.scale.height / 2, `Team score: ${r?.teamPoints ?? 0}`, { fontFamily: 'Arial', fontSize: '72px', color: '#fff' }).setOrigin(0.5);
  }
}
