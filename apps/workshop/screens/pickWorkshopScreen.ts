/** pickWorkshop: two big tiles, Race Shop and Dino Lab. Preselects the last workshop. B returns to the profiles. */
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import type { WorkshopId } from '../core/types';
import { engine } from '../logic';
import type { ShellPaneContext } from '../shell/paneContext';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { carIconTexture, dinoIconTexture } from '../ui/icons';
import { addBackButton, addHeader } from '../ui/screenChrome';
import { COLORS, makeText } from '../ui/style';

const TILES: { id: WorkshopId; label: string; color: number }[] = [
  { id: 'race', label: 'Race Shop', color: 0xffb3b3 },
  { id: 'dino', label: 'Dino Lab', color: 0xa8e6a1 },
];

const pickWorkshopScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup;
  const objs: Phaser.GameObjects.GameObject[] = [];

  const backToProfiles = () => {
    ctx.audio.sfx('back');
    ctx.go('profile');
  };

  const pick = (id: WorkshopId) => {
    ctx.setWorkshop(id);
    const save = ctx.save();
    ctx.commit({ ...save, lastWorkshop: id, workshops: { ...save.workshops, [id]: engine.progressOf(save, id) } });
    ctx.go('room');
  };

  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.setWorkshop(undefined);
      ctx.audio.music('title');
      const { w } = ctx.size;
      const wide = ctx.layout === 'wide';
      objs.push(addHeader(ctx, 'Where do you want to work?', 110));
      const tiles = TILES.map((t, i) => {
        const tw = wide ? 780 : Math.min(860, w - 60);
        const th = wide ? 640 : 340;
        const x = wide ? w / 2 + (i === 0 ? -420 : 420) : w / 2;
        const y = wide ? 560 : 330 + i * 380;
        const b = new Button(ctx.scene, { x, y, w: tw, h: th, color: t.color, onClick: () => pick(t.id) });
        const icon = ctx.scene.add.image(0, wide ? -90 : -35, t.id === 'race' ? carIconTexture(ctx.scene) : dinoIconTexture(ctx.scene)).setScale(wide ? 1.7 : 1.05);
        b.add([icon, makeText(ctx.scene, 0, wide ? 210 : 120, t.label, { size: wide ? 96 : 76, color: COLORS.ink })]);
        return b;
      });
      const back = addBackButton(ctx, backToProfiles);
      objs.push(...tiles, back);
      group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
      group.set([...tiles, back]);
      const last = ctx.save().lastWorkshop;
      group.focus(tiles[Math.max(0, TILES.findIndex((t) => t.id === last))]);
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

export default pickWorkshopScreen;
