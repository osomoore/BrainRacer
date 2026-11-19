import Phaser from 'phaser';
import { REG, SCENE } from '../keys';

/** ?dev=ResultsTest[&pts=40&players=2] — jumps straight to the ResultsScene with fake results. */
export default class ResultsTest extends Phaser.Scene {
  constructor() { super('ResultsTest'); }
  create() {
    const q = new URLSearchParams(location.search);
    const pts = Number(q.get('pts') ?? 24);
    const n = Number(q.get('players') ?? 2);
    const players = Array.from({ length: n }, (_, i) => ({ correct: 8 - i * 2, wrong: 2 + i, timeouts: 1, goals: 3 - i, points: Math.round(pts / n) }));
    this.registry.set(REG.results, { teamPoints: pts, players, goalsCompleted: 3, seed: 1 });
    this.scene.start(SCENE.results);
  }
}
