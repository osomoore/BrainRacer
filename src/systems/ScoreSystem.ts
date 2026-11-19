/** Per-player stats and team score. Emits score:changed and '+1' popups. */
import type { GameSystem, RaceContext } from '../core/race';
import type { PlayerId } from '../core/types';
import { applyChallenge, applyGoal, roundStore, teamTotal } from './roundStats';

export class ScoreSystem implements GameSystem {
  readonly name = 'score';
  private offs: (() => void)[] = [];
  private ctx!: RaceContext;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    roundStore.reset(ctx.players.length);
    this.emit();
    this.offs.push(
      ctx.bus.on('round:start', () => this.emit()),
      ctx.bus.on('challenge:resolved', ({ challenge, result }) => {
        const s = roundStore.players[challenge.player];
        if (!s) return;
        applyChallenge(s, result);
        if (result === 'correct') ctx.bus.emit('ui:popup', { player: challenge.player, text: '+1', color: '#7CFC00' });
        this.emit();
      }),
      ctx.bus.on('goal:completed', ({ arrived }) => {
        roundStore.goalsCompleted++;
        for (const p of arrived as PlayerId[]) {
          const s = roundStore.players[p];
          if (s) applyGoal(s, ctx.settings.goalPointsPerCar);
        }
        this.emit();
      }),
    );
  }

  update(): void {}

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }

  private emit() {
    const perPlayer = roundStore.players.map((p) => p.points);
    this.ctx.bus.emit('score:changed', { team: teamTotal(roundStore.players), perPlayer });
  }
}
