/** reading: reading-level chooser for an existing profile entering the workshop the first time. B returns to the profiles. */
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import type { ShellPaneContext } from '../shell/paneContext';
import { shell } from '../shell/shell';
import type { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { addBackButton, addHeader } from '../ui/screenChrome';
import { buildLevelPicker } from './reading/levelPicker';

const readingScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const backToProfiles = () => {
    ctx.audio.sfx('back');
    ctx.go('profile');
  };
  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.audio.music('title');
      objs.push(addHeader(ctx, 'How well do you read?', 110));
      const buttons: Button[] = buildLevelPicker(ctx, (level) => {
        const id = ctx.profileId;
        if (id) {
          const save = shell.store.player(id) ?? engine.newPlayerSave(level);
          shell.store.setPlayer(id, { ...save, reading: level });
        }
        ctx.go('pickWorkshop');
      });
      const back = addBackButton(ctx, backToProfiles);
      objs.push(...buttons, back);
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      group.set([...buttons, back]);
      const cur = ctx.reading();
      group.focus(buttons[['easy', 'medium', 'hard'].indexOf(cur)] ?? buttons[1]);
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (a === 'back') backToProfiles();
        else group.handle(a);
      }
    },
    destroy() {
      group?.destroy();
      objs.forEach((o) => o.destroy());
      objs.length = 0;
    },
  };
};

export default readingScreen;
