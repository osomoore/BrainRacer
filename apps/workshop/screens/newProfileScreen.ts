/** Shared name-entry UI followed by the Workshop's reading-level step. */
import { createProfile, listProfiles, PROFILE_NAME } from '../../../shared/profiles';
import { LetterPicker } from '../../../shared/ui/menu/LetterPicker';
import { bigText, FONT_HEAD, MENU } from '../../../shared/ui/menu/style';
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import { hashSeed } from '../logic/util';
import type { ShellPaneContext } from '../shell/paneContext';
import { shell } from '../shell/shell';
import { FocusGroup } from '../ui/FocusGroup';
import { ProfileMenuButton } from '../ui/ProfileMenuButton';
import { menuBackground, playerMenuColor } from '../ui/profileMenu';
import { checkName, NAME_MESSAGES } from '../ui/profileName';
import { addBackButton, addHeader } from '../ui/screenChrome';
import { READING_LEVELS } from '../core/types';
import { buildLevelPicker } from './reading/levelPicker';

const NO_INPUT = { navX: 0, navY: 0, confirm: false, back: false };

const newProfileScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup | undefined;
  let picker: LetterPicker | undefined;
  let message: Phaser.GameObjects.Text;
  let name = '';
  let typing = false;
  const objs: Phaser.GameObjects.GameObject[] = [];

  const clear = () => {
    group?.destroy(); group = undefined;
    picker?.destroy(); picker = undefined;
    objs.splice(0).forEach((o) => o.destroy());
  };

  const showName = () => {
    clear();
    typing = false;
    const { w, h } = ctx.size;
    const color = playerMenuColor(ctx.index);
    const wide = ctx.layout === 'wide';
    const back = new ProfileMenuButton(ctx.scene, wide ? w - 190 : w - 152, 70, wide ? 300 : 240, 100, 'BACK', color, 50, () => ctx.go('profile'));
    objs.push(menuBackground(ctx.scene, w, h), back);
    objs.push(bigText(ctx.scene, 40, 70, `PLAYER ${ctx.index + 1}`, 48, `#${color.toString(16)}`, { font: FONT_HEAD, origin: [0, 0.5] }));
    picker = new LetterPicker(ctx.scene, w / 2, wide ? 70 : 124, {
      title: "WHAT'S YOUR NAME?", initial: name, maxLen: PROFILE_NAME.maxLen, color, keyboardTyping: false,
      sfx: (cue) => ctx.audio.sfx(cue === 'menuMove' ? 'click' : 'select'),
    });
    message = bigText(ctx.scene, w / 2, h - 32, '', 44, MENU.yellow, { font: FONT_HEAD, wrap: w - 50 });
    objs.push(message);
  };

  const validated = (value: string) => checkName(value, listProfiles().map((p) => p.name));

  const showLevel = () => {
    clear();
    objs.push(addHeader(ctx, `${name}, how well do you read?`, 110, ctx.layout === 'wide' ? 76 : 52));
    const buttons = buildLevelPicker(ctx, (level) => {
      // Both panes can reach this step before either has saved a name.
      const checked = validated(name);
      const profile = checked.ok ? createProfile(checked.name) : null;
      if (!profile) {
        showName();
        message.setText(NAME_MESSAGES[checked.ok ? 'empty' : checked.reason]);
        return;
      }
      shell.store.setPlayer(profile.id, engine.newPlayerSave(level, hashSeed(profile.id)));
      ctx.setProfile(profile.id);
      ctx.audio.sfx('sparkle');
      ctx.go('pickWorkshop');
    });
    const back = addBackButton(ctx, showName);
    objs.push(...buttons, back);
    group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
    group.set([...buttons, back]);
    group.focus(buttons[READING_LEVELS.indexOf('medium')]);
  };

  const done = (value: string) => {
    const checked = validated(value);
    if (!checked.ok) {
      message.setText(NAME_MESSAGES[checked.reason]);
      ctx.audio.sfx('back');
      return;
    }
    name = checked.name;
    showLevel();
  };

  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.audio.music('title');
      showName();
    },
    update() {
      const actions = ctx.input.poll();
      const text = ctx.input.text();
      if (!picker) {
        for (const action of actions) {
          if (action === 'back') { showName(); return; }
          group?.handle(action);
          if (action === 'confirm') return;
        }
        return;
      }

      if (picker.handle(NO_INPUT) === 'done') { done(picker.value); return; }
      for (const ch of text) {
        if (ch === '\n') {
          if (typing && picker.value.trim()) { done(picker.value); return; }
        } else {
          typing = true;
          message.setText('');
          picker.typeText(ch);
        }
      }
      for (const action of actions) {
        const input = {
          navX: Number(action === 'right') - Number(action === 'left'),
          navY: Number(action === 'down') - Number(action === 'up'),
          confirm: action === 'confirm',
          back: action === 'back',
        };
        message.setText('');
        const result = picker.handle(input);
        if (result === 'done') { done(picker.value); return; }
        if (result === 'cancel') { ctx.go('profile'); return; }
      }
    },
    destroy: clear,
  };
};

export default newProfileScreen;
