/**
 * Fallback player for scenarios without their own file: the model drives (or walks) across a plain meadow;
 * success = exits right happily, failure = bonk, tumble and dizzy stars.
 */
import { WS_RUN } from '../../config';
import type { WorkshopId } from '../../core/types';
import type { ScenarioPlayer, StageContext } from '../types';
import { P } from './props';
import { SideStage } from './side';

export function genericPlayer(workshop: WorkshopId, scenario: string): ScenarioPlayer {
  return {
    workshop, scenario,
    async play(ctx: StageContext): Promise<void> {
      const S = new SideStage(ctx, { worldW: 3200, clouds: 4, hills: [{ color: '#9be08a', h: 260, f: 0.2 }, { color: '#6cc96a', h: 180, f: 0.4, seed: 3 }] });
      for (let i = 0; i < 9; i++) S.put('back', i % 3 === 0 ? P.tree() : P.bush(), 500 + i * 330 + ctx.rng.int(-60, 60));
      const ok = ctx.result.passed;
      S.place(200);
      const walk = ctx.workshop === 'dino' ? 'walk' : 'drive';
      ctx.rig.play(walk);
      ctx.audio.sfx('engine', { volume: 0.4 });
      if (ok) {
        await S.driveTo(2200, WS_RUN.stageSec * 600);
        await S.cheer();
        await S.exit();
      } else {
        await S.driveTo(1500, WS_RUN.stageSec * 400);
        ctx.audio.sfx('thud');
        ctx.rig.play('tumble');
        await ctx.wait(1000);
        ctx.rig.play('dizzy');
        const d = S.dizzy();
        ctx.audio.sfx('sad');
        await ctx.wait(WS_RUN.failHoldMs);
        d.stop();
      }
    },
  };
}
