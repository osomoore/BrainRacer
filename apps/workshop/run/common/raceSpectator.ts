import { P } from './props';
import type { SideStage } from './side';

/** A grounded watcher who raises both arms and hops when the car makes it. */
export function raceSpectator(stage: SideStage, x: number, shirt: string, hat: string, y = stage.groundAt(x)) {
  const watching = stage.put('back', P.person(shirt, hat), x, y, 1.12);
  const cheering = stage.put('back', P.person(shirt, hat, 'up'), x, y, 1.12).setVisible(false);
  const surprise = stage.put('front', P.exclaim(), x, y - 258, 0.75).setVisible(false);
  return {
    cheer() {
      watching.setVisible(false);
      cheering.setVisible(true);
      void stage.hop(cheering, x, y, 560, 85, 'Linear');
    },
    gasp() {
      surprise.setVisible(true);
      void stage.ctx.tween({ targets: surprise, y: y - 304, alpha: 0, delay: 250, duration: 570 });
    },
  };
}
