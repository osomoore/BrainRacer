import { WS_RUN } from '../../config';
import { CATALOGS } from '../../content';
import type { StageContext } from '../types';
import { practiceBeats, type PracticeBeat } from './practicePlan';

/** Keep the player's build across cuts. Each backdrop, prop and effect belongs to one beat. */
export async function playPractice(
  ctx: StageContext, scenes: Readonly<Record<string, (ctx: StageContext, beat: PracticeBeat) => Promise<void>>>,
): Promise<void> {
  const beats = practiceBeats(CATALOGS[ctx.workshop], ctx.stage, ctx.requirements);
  const { root } = ctx.rig;
  for (const [index, beat] of beats.entries()) {
    const layer = ctx.scene.add.container(0, 0);
    ctx.layer.addAt(layer, 0);
    root.setScale(1).setRotation(0).setAlpha(1).setVisible(true);
    if (index > 0) {
      layer.setAlpha(0);
      void ctx.tween({ targets: layer, alpha: 1, duration: WS_RUN.practice.cutMs });
    }
    await scenes[beat.part.aspect]({ ...ctx, layer }, beat);
    if (index === beats.length - 1) break;
    await ctx.tween({ targets: layer, alpha: 0, duration: WS_RUN.practice.cutMs });
    ctx.layer.add(root);
    layer.destroy();
  }
}
