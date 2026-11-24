/**
 * profile: shared profiles as big name cards (paged) plus "New Player". The other pane's profile is shown but locked;
 * nothing here can delete a profile. A profile without a workshop save goes to `reading`, otherwise to `pickWorkshop`.
 */
import { listProfiles, type PlayerProfile } from '../../../shared/profiles';
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import type { ShellPaneContext } from '../shell/paneContext';
import { shell } from '../shell/shell';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { pageCount, pageItems } from '../ui/paging';
import { addBackButton, addHeader, cardColor } from '../ui/screenChrome';
import { COLORS } from '../ui/style';

const profileScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup;
  let pager: Pager;
  let back: Button;
  let cards: Button[] = [];
  const objs: Phaser.GameObjects.GameObject[] = [];
  let profiles: PlayerProfile[] = [];
  let perPage = 8;
  let cols = 4;

  const choose = (id: string) => {
    ctx.setProfile(id);
    ctx.go(shell.store.hasPlayer(id) ? 'pickWorkshop' : 'reading');
  };

  const buildPage = (page: number) => {
    cards.forEach((b) => b.destroy());
    const locked = ctx.otherProfileId();
    const wide = ctx.layout === 'wide';
    const cw = wide ? 380 : 410, ch = wide ? 200 : 190;
    const gapX = 40, gapY = wide ? 40 : 40;
    const gridW = cols * cw + (cols - 1) * gapX;
    const left = (ctx.size.w - gridW) / 2 + cw / 2;
    const top = wide ? 330 : 330;
    const items: (PlayerProfile | null)[] = [...profiles, null];
    cards = pageItems(items, page, perPage).map((p, k) => {
      const x = left + (k % cols) * (cw + gapX);
      const y = top + Math.floor(k / cols) * (ch + gapY);
      const index = page * perPage + k;
      if (!p) {
        return new Button(ctx.scene, { x, y, w: cw, h: ch, label: '+ New', fontSize: 64, color: COLORS.green, textColor: COLORS.paper, onClick: () => ctx.go('newProfile') });
      }
      const inUse = p.id === locked;
      const b = new Button(ctx.scene, { x, y, w: cw, h: ch, label: p.name, sub: inUse ? 'Playing now' : undefined, fontSize: 64, color: inUse ? 0xb8c0cc : cardColor(index), onClick: () => choose(p.id) });
      if (inUse) b.setEnabled(false);
      return b;
    });
    group.set([...cards, ...pager.buttons, back]);
    group.focusFirst();
  };

  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.setProfile(undefined);
      ctx.audio.music('title');
      const wide = ctx.layout === 'wide';
      cols = wide ? 4 : 2;
      perPage = wide ? 8 : 6;
      profiles = listProfiles();
      objs.push(addHeader(ctx, 'Who is playing?', 130));
      group = new FocusGroup({
        audio: ctx.audio, touch: ctx.input.touch,
        onEdge: (dir) => { if (dir === 'left') pager.go(-1); else if (dir === 'right') pager.go(1); },
      });
      pager = new Pager(ctx.scene, {
        x: ctx.size.w / 2 + (wide ? 0 : 60), y: ctx.size.h - 90, pages: pageCount(profiles.length + 1, perPage), gap: wide ? 150 : 100,
        onChange: (p) => buildPage(p),
      });
      back = addBackButton(ctx, () => ctx.exit());
      buildPage(0);
    },
    update() {
      for (const a of ctx.input.poll()) {
        if (a === 'back') ctx.exit();
        else group.handle(a);
      }
    },
    destroy() {
      group?.destroy();
      pager?.destroy();
      cards.forEach((b) => b.destroy());
      cards = [];
      back?.destroy();
      objs.forEach((o) => o.destroy());
      objs.length = 0;
    },
  };
};

export default profileScreen;
