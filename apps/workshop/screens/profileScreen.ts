/** Choose a shared profile, then ask for a reading level on its first Workshop visit. */
import { listProfiles, type PlayerProfile } from '../../../shared/profiles';
import { drawJoinPanelFrame } from '../../../shared/ui/menu/JoinPanel';
import { bigText, FONT_HEAD, MENU } from '../../../shared/ui/menu/style';
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import type { ShellPaneContext } from '../shell/paneContext';
import { shell } from '../shell/shell';
import type { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { Pager } from '../ui/Pager';
import { pageCount, pageItems } from '../ui/paging';
import { ProfileMenuButton } from '../ui/ProfileMenuButton';
import { menuBackground, playerMenuColor } from '../ui/profileMenu';
import { familySync } from '../../../shared/sync/runtime';
import { syncDotColor } from '../../../shared/sync/panel';

const profileScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup<ProfileMenuButton | Button>;
  let pager: Pager;
  let back: ProfileMenuButton;
  let cards: { button: ProfileMenuButton; id?: string }[] = [];
  const objs: Phaser.GameObjects.GameObject[] = [];
  let profiles: PlayerProfile[] = [];
  let locked: string | undefined;
  let cols: number;
  let perPage: number;
  let unsubSync = () => {};
  let unsubProfiles = () => {};

  const refreshProfiles = () => {
    const latest = listProfiles();
    const changed = latest.length !== profiles.length || latest.some((p, i) => p.id !== profiles[i]?.id || p.name !== profiles[i]?.name);
    if (!changed) return;
    profiles = latest;
    locked = ctx.otherProfileId();
    pager.setPages(pageCount(profiles.length + 1, perPage));
    buildPage(Math.min(pager.page, pageCount(profiles.length + 1, perPage) - 1));
  };

  const choose = (id: string) => {
    // The other pane may have selected this card in the same frame.
    if (id === ctx.otherProfileId()) return;
    ctx.setProfile(id);
    familySync.chooseProfile(id);
    ctx.go(shell.store.hasPlayer(id) ? 'pickWorkshop' : 'reading');
  };

  const buildPage = (page: number) => {
    cards.forEach(({ button }) => button.destroy());
    const wide = ctx.layout === 'wide';
    const items = pageItems([...profiles, null], page, perPage);
    const color = playerMenuColor(ctx.index);
    const pitch = wide ? 390 : 360;
    const rowPitch = wide ? 235 : 170;
    const rows = Math.ceil(items.length / cols);
    const firstX = ctx.size.w / 2 - (Math.min(cols, items.length) - 1) * pitch / 2;
    const firstY = 560 - (rows - 1) * rowPitch / 2;
    cards = items.map((profile, i) => {
      const x = firstX + (i % cols) * pitch;
      const y = firstY + Math.floor(i / cols) * rowPitch;
      const button = new ProfileMenuButton(ctx.scene, x, y, pitch - 90, wide ? 168 : 128,
        profile?.name ?? '+ New', color, wide ? 58 : 48,
        () => profile ? choose(profile.id) : ctx.go('newProfile'));
      if (profile && profile.id === locked) button.setEnabled(false);
      return { button, id: profile?.id };
    });
    group.set([...cards.map(({ button }) => button), ...pager.buttons, back]);
    group.focusFirst();
  };

  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.setProfile(undefined);
      ctx.audio.music('title');
      const { w, h } = ctx.size;
      const wide = ctx.layout === 'wide';
      cols = wide ? 4 : 2;
      perPage = wide ? 8 : 6;
      const color = playerMenuColor(ctx.index);
      locked = ctx.otherProfileId();
      profiles = listProfiles();
      const frame = ctx.scene.add.graphics().setPosition(w / 2, 530);
      drawJoinPanelFrame(frame, wide ? w - 220 : w - 76, 630, color, true, false);
      objs.push(menuBackground(ctx.scene, w, h), frame,
        bigText(ctx.scene, w / 2, 113, 'WHO IS PLAYING?', wide ? 96 : 74, MENU.yellow, { font: FONT_HEAD }),
        bigText(ctx.scene, w / 2, 265, `PLAYER ${ctx.index + 1}`, 48, `#${color.toString(16)}`, { font: FONT_HEAD }));
      group = new FocusGroup({
        audio: ctx.audio, touch: ctx.input.touch,
        onEdge: (dir) => { if (dir === 'left') pager.go(-1); else if (dir === 'right') pager.go(1); },
      });
      pager = new Pager(ctx.scene, {
        x: w / 2 + (wide ? 0 : 105), y: h - 130, pages: pageCount(profiles.length + 1, perPage), gap: wide ? 150 : 70,
        onChange: buildPage,
      });
      back = new ProfileMenuButton(ctx.scene, 175, h - 130, 240, 112, 'BACK', color, 50, () => ctx.exit());
      buildPage(0);
      const dotColor = syncDotColor();
      if (dotColor !== null) {
        const dot = ctx.scene.add.circle(42, 40, 11, dotColor).setStrokeStyle(2, 0xffffff);
        objs.push(dot);
        unsubSync = familySync.subscribe(() => dot.setFillStyle(syncDotColor()!));
      }
      unsubProfiles = familySync.subscribeProfiles(refreshProfiles);
    },
    update() {
      const nextLock = ctx.otherProfileId();
      if (nextLock !== locked) {
        locked = nextLock;
        const latest = listProfiles();
        if (latest.length !== profiles.length) {
          profiles = latest;
          pager.setPages(pageCount(profiles.length + 1, perPage));
          buildPage(pager.page);
        } else {
          for (const { button, id } of cards) button.setEnabled(id === undefined || id !== locked);
        }
      }
      for (const action of ctx.input.poll()) {
        if (action === 'back') { ctx.exit(); return; }
        group.handle(action);
        if (action === 'confirm') return;
      }
    },
    destroy() {
      unsubSync();
      unsubProfiles();
      group.destroy();
      pager.destroy();
      cards.forEach(({ button }) => button.destroy());
      back.destroy();
      objs.forEach((o) => o.destroy());
    },
  };
};

export default profileScreen;
