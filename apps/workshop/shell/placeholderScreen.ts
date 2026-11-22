/** Built-in screens: the "coming soon" placeholder and the "waiting" screen of a pane whose player left (2P). */
import type Phaser from 'phaser';
import type { PaneContext, Screen } from '../core/runtime';
import type { ShellPaneContext } from './paneContext';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { promptLabel } from '../ui/input';
import { COLORS, makeText, backdropTexture } from '../ui/style';

function simpleScreen(text: (ctx: ShellPaneContext) => string, buttonLabel: string, action: (ctx: ShellPaneContext) => void, withBackKey: boolean): Screen {
  const objs: Phaser.GameObjects.GameObject[] = [];
  let group: FocusGroup | undefined;
  let ctx!: ShellPaneContext;
  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      const { w, h } = ctx.size;
      const s = ctx.scene;
      objs.push(s.add.image(0, 0, backdropTexture(s, w, h)).setOrigin(0).setDepth(-1000));
      objs.push(makeText(s, w / 2, h * 0.36, text(ctx), { size: 72, color: COLORS.paper, stroke: COLORS.ink, wrap: w - 100 }));
      const b = new Button(s, { x: w / 2, y: h * 0.62, w: 520, h: 150, label: buttonLabel, color: COLORS.yellow, fontSize: 64, badge: promptLabel(ctx.input, 'confirm'), onClick: () => action(ctx) });
      objs.push(b);
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      group.set([b]);
      group.focus(b);
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (a === 'back' && withBackKey) action(ctx);
        else group?.handle(a);
      }
    },
    destroy() {
      group?.destroy();
      objs.forEach((o) => o.destroy());
      objs.length = 0;
    },
  };
}

export function placeholderScreen(id: string): Screen {
  return simpleScreen(() => `${id} coming soon`, 'Back', (c) => c.back(), true);
}

/** Shown in a pane after its player pressed B on the profile screen while the other player is still playing. */
export function waitingScreen(): Screen {
  return simpleScreen(() => 'Want to play again?', 'Play', (c) => c.go('profile'), false);
}
